/**
 * Pure JS media file chunker for splitting large audio/video files
 * into valid segments that fit within Groq Whisper's 25MB limit.
 *
 * Supports:
 * - WebM (Opus/VP9): Split at EBML Cluster boundaries
 * - MP3: Split at frame sync word boundaries
 * - WAV: Split PCM data with header duplication
 */

const DEFAULT_MAX_CHUNK_SIZE = 22 * 1024 * 1024 // 22MB (3MB headroom under 25MB limit, accounting for multipart headers + form boundaries)

// ==================== WEBM CHUNKING ====================

/**
 * WebM/Matroska EBML element IDs (big-endian)
 * Cluster ID = 0x1F43B675 (4 bytes)
 */
const CLUSTER_ID = [0x1F, 0x43, 0xB6, 0x75]

/**
 * Read an EBML variable-length integer (VINT) from a buffer.
 * Returns the value and the number of bytes consumed.
 */
function readEbmlVint(data: Uint8Array, offset: number): { value: number; length: number } | null {
    if (offset >= data.length) return null

    const firstByte = data[offset]
    let length = 0
    let mask = 0x80

    // Count leading zeros to determine VINT length (1-8 bytes)
    for (let i = 0; i < 8; i++) {
        if (firstByte & mask) {
            length = i + 1
            break
        }
        mask >>= 1
    }

    if (length === 0 || offset + length > data.length) return null

    // Read the value (first byte has the length bits masked off)
    let value = firstByte & (mask - 1)
    for (let i = 1; i < length; i++) {
        value = (value << 8) | data[offset + i]
    }

    return { value, length }
}

/**
 * Find all Cluster element boundaries in a WebM file.
 * Returns byte offsets where each Cluster starts.
 */
function findClusterOffsets(data: Uint8Array): number[] {
    const offsets: number[] = []

    // Scan for Cluster ID pattern (0x1F 0x43 0xB6 0x75)
    for (let i = 0; i < data.length - 4; i++) {
        if (
            data[i] === CLUSTER_ID[0] &&
            data[i + 1] === CLUSTER_ID[1] &&
            data[i + 2] === CLUSTER_ID[2] &&
            data[i + 3] === CLUSTER_ID[3]
        ) {
            // Verify this is a valid EBML element by checking the size VINT after ID
            const sizeVint = readEbmlVint(data, i + 4)
            if (sizeVint) {
                offsets.push(i)
                // Skip past this element to avoid false matches inside data
                // But don't skip too far — Clusters can contain the same byte pattern
                // We'll just skip past the ID + size header
                i += 3 + sizeVint.length
            }
        }
    }

    return offsets
}

/**
 * Split a WebM file at Cluster boundaries.
 * Each chunk gets the original header (everything before the first Cluster) prepended.
 */
function chunkWebM(data: Uint8Array, maxChunkSize: number): Uint8Array[] {
    const clusterOffsets = findClusterOffsets(data)

    if (clusterOffsets.length === 0) {
        // No clusters found — return the whole file as one chunk
        return [data]
    }

    // Everything before the first Cluster is the header (EBML Header + Segment + Tracks + Info)
    const headerEnd = clusterOffsets[0]
    const header = data.slice(0, headerEnd)

    // If header alone is too large, we can't chunk properly
    if (header.length >= maxChunkSize) {
        return [data]
    }

    const maxDataPerChunk = maxChunkSize - header.length
    const chunks: Uint8Array[] = []
    let chunkStart = 0 // Index into clusterOffsets

    while (chunkStart < clusterOffsets.length) {
        let chunkEnd = chunkStart
        let accumulatedSize = 0

        // Add clusters until we approach the size limit
        while (chunkEnd < clusterOffsets.length) {
            const clusterStart = clusterOffsets[chunkEnd]
            const clusterEnd = chunkEnd + 1 < clusterOffsets.length
                ? clusterOffsets[chunkEnd + 1]
                : data.length
            const clusterSize = clusterEnd - clusterStart

            if (accumulatedSize + clusterSize > maxDataPerChunk && chunkEnd > chunkStart) {
                break
            }

            accumulatedSize += clusterSize
            chunkEnd++
        }

        // Build chunk: header + cluster data
        const dataStart = clusterOffsets[chunkStart]
        const dataEnd = chunkEnd < clusterOffsets.length
            ? clusterOffsets[chunkEnd]
            : data.length
        const clusterData = data.slice(dataStart, dataEnd)

        const chunk = new Uint8Array(header.length + clusterData.length)
        chunk.set(header, 0)
        chunk.set(clusterData, header.length)
        chunks.push(chunk)

        chunkStart = chunkEnd
    }

    return chunks
}

// ==================== MP3 CHUNKING ====================

/**
 * Find MP3 frame sync word boundaries.
 * MP3 frames start with 11 set bits (0xFFE0 mask).
 * We validate basic header fields to avoid false sync matches.
 */
function findMP3FrameOffsets(data: Uint8Array): number[] {
    const offsets: number[] = []

    for (let i = 0; i < data.length - 4; i++) {
        // Check for sync word: 0xFF followed by 0xE0+ (11 bits set)
        if (data[i] === 0xFF && (data[i + 1] & 0xE0) === 0xE0) {
            // Basic validation: MPEG version and layer should not be reserved
            const version = (data[i + 1] >> 3) & 0x03
            const layer = (data[i + 1] >> 1) & 0x03
            const bitrateIdx = (data[i + 2] >> 4) & 0x0F

            // version 01 = reserved, layer 00 = reserved, bitrate 1111 = bad
            if (version !== 1 && layer !== 0 && bitrateIdx !== 0x0F && bitrateIdx !== 0x00) {
                offsets.push(i)

                // Calculate frame size to skip to next frame
                const frameSize = getMP3FrameSize(data, i)
                if (frameSize > 0) {
                    i += frameSize - 1 // -1 because loop increments
                }
            }
        }
    }

    return offsets
}

/**
 * Calculate MP3 frame size from header.
 */
function getMP3FrameSize(data: Uint8Array, offset: number): number {
    if (offset + 4 > data.length) return 0

    const version = (data[offset + 1] >> 3) & 0x03
    const layer = (data[offset + 1] >> 1) & 0x03
    const bitrateIdx = (data[offset + 2] >> 4) & 0x0F
    const sampleRateIdx = (data[offset + 2] >> 2) & 0x03
    const padding = (data[offset + 2] >> 1) & 0x01

    // Bitrate tables (kbps) — MPEG1 Layer III
    const bitrates: Record<string, number[]> = {
        // [version][layer]
        '3_3': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0], // V1 L1
        '3_2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],    // V1 L2
        '3_1': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],     // V1 L3
        '2_1': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],         // V2 L3
    }

    const sampleRates: Record<number, number[]> = {
        3: [44100, 48000, 32000, 0], // MPEG1
        2: [22050, 24000, 16000, 0], // MPEG2
        0: [11025, 12000, 8000, 0],  // MPEG2.5
    }

    const key = `${version}_${layer}`
    const bitrateTable = bitrates[key] || bitrates['3_1']
    const bitrate = bitrateTable[bitrateIdx]
    const sampleRate = (sampleRates[version] || sampleRates[3])[sampleRateIdx]

    if (!bitrate || !sampleRate) return 0

    if (layer === 3) {
        // Layer I: frame size = (12 * bitrate / sampleRate + padding) * 4
        return Math.floor(12 * bitrate * 1000 / sampleRate + padding) * 4
    } else {
        // Layer II & III: frame size = 144 * bitrate / sampleRate + padding
        return Math.floor(144 * bitrate * 1000 / sampleRate) + padding
    }
}

/**
 * Split an MP3 file at frame sync boundaries.
 */
function chunkMP3(data: Uint8Array, maxChunkSize: number): Uint8Array[] {
    const frameOffsets = findMP3FrameOffsets(data)

    if (frameOffsets.length === 0) {
        return [data]
    }

    // Check for ID3v2 header at the start (skip it but include in every chunk)
    let id3Header: Uint8Array | null = null
    if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) { // "ID3"
        // ID3v2 header: 10 bytes header + size (syncsafe integer)
        const size = ((data[6] & 0x7F) << 21) | ((data[7] & 0x7F) << 14) |
            ((data[8] & 0x7F) << 7) | (data[9] & 0x7F)
        const id3End = 10 + size
        id3Header = data.slice(0, id3End)
    }

    const headerSize = id3Header?.length || 0
    const maxDataPerChunk = maxChunkSize - headerSize
    const chunks: Uint8Array[] = []
    let chunkStart = 0

    while (chunkStart < frameOffsets.length) {
        let chunkEnd = chunkStart
        let accumulatedSize = 0

        while (chunkEnd < frameOffsets.length) {
            const frameStart = frameOffsets[chunkEnd]
            const frameEnd = chunkEnd + 1 < frameOffsets.length
                ? frameOffsets[chunkEnd + 1]
                : data.length
            const frameSize = frameEnd - frameStart

            if (accumulatedSize + frameSize > maxDataPerChunk && chunkEnd > chunkStart) {
                break
            }

            accumulatedSize += frameSize
            chunkEnd++
        }

        const dataStart = frameOffsets[chunkStart]
        const dataEnd = chunkEnd < frameOffsets.length
            ? frameOffsets[chunkEnd]
            : data.length
        const frameData = data.slice(dataStart, dataEnd)

        if (id3Header) {
            const chunk = new Uint8Array(id3Header.length + frameData.length)
            chunk.set(id3Header, 0)
            chunk.set(frameData, id3Header.length)
            chunks.push(chunk)
        } else {
            chunks.push(frameData)
        }

        chunkStart = chunkEnd
    }

    return chunks
}

// ==================== WAV CHUNKING ====================

/**
 * Split a WAV file by duplicating the header for each chunk of PCM data.
 */
function chunkWAV(data: Uint8Array, maxChunkSize: number): Uint8Array[] {
    // Standard WAV header is 44 bytes, but may be longer with extra chunks
    // Find the "data" subchunk
    let dataOffset = 12 // Skip "RIFF" + size + "WAVE"
    let dataSize = 0

    while (dataOffset < data.length - 8) {
        const chunkId = String.fromCharCode(data[dataOffset], data[dataOffset + 1], data[dataOffset + 2], data[dataOffset + 3])
        const chunkSize = data[dataOffset + 4] | (data[dataOffset + 5] << 8) |
            (data[dataOffset + 6] << 16) | (data[dataOffset + 7] << 24)

        if (chunkId === 'data') {
            dataSize = chunkSize
            dataOffset += 8 // Skip "data" + size
            break
        }

        dataOffset += 8 + chunkSize
    }

    if (dataSize === 0) {
        return [data]
    }

    // Header = everything before PCM data
    const header = data.slice(0, dataOffset)
    const pcmData = data.slice(dataOffset, dataOffset + dataSize)

    // Calculate bytes per sample to align chunk boundaries
    // fmt chunk at offset 20: channels(2) + sampleRate(4) + byteRate(4) + blockAlign(2)
    const blockAlign = data[32] | (data[33] << 8)
    const maxPcmPerChunk = Math.floor((maxChunkSize - header.length) / blockAlign) * blockAlign

    if (maxPcmPerChunk <= 0) {
        return [data]
    }

    const chunks: Uint8Array[] = []
    let offset = 0

    while (offset < pcmData.length) {
        const end = Math.min(offset + maxPcmPerChunk, pcmData.length)
        const pcmChunk = pcmData.slice(offset, end)
        const pcmChunkSize = pcmChunk.length

        // Create new WAV header with updated sizes
        const chunkHeader = new Uint8Array(header)
        // Update RIFF chunk size (offset 4): file size - 8
        const riffSize = chunkHeader.length - 8 + pcmChunkSize
        chunkHeader[4] = riffSize & 0xFF
        chunkHeader[5] = (riffSize >> 8) & 0xFF
        chunkHeader[6] = (riffSize >> 16) & 0xFF
        chunkHeader[7] = (riffSize >> 24) & 0xFF
        // Update data chunk size (last 4 bytes of header before PCM)
        const dataSizeOffset = chunkHeader.length - 4
        chunkHeader[dataSizeOffset] = pcmChunkSize & 0xFF
        chunkHeader[dataSizeOffset + 1] = (pcmChunkSize >> 8) & 0xFF
        chunkHeader[dataSizeOffset + 2] = (pcmChunkSize >> 16) & 0xFF
        chunkHeader[dataSizeOffset + 3] = (pcmChunkSize >> 24) & 0xFF

        const chunk = new Uint8Array(chunkHeader.length + pcmChunkSize)
        chunk.set(chunkHeader, 0)
        chunk.set(pcmChunk, chunkHeader.length)
        chunks.push(chunk)

        offset = end
    }

    return chunks
}

// ==================== MP4 → AAC/ADTS EXTRACTION ====================
//
// Instead of building complex MP4 files (which are fragile), we extract
// raw AAC frames from MP4 and wrap them in ADTS format — a simple
// streaming container that Groq/Whisper can decode directly.
//
// ADTS = Audio Data Transport Stream. Each frame gets a 7-byte header
// containing codec info + frame size. No moov/atoms needed.

/**
 * Read a big-endian 32-bit unsigned integer from a Uint8Array.
 */
function readUint32BE(data: Uint8Array, offset: number): number {
    return (
        ((data[offset] << 24) >>> 0) +
        (data[offset + 1] << 16) +
        (data[offset + 2] << 8) +
        data[offset + 3]
    )
}

/**
 * Write a big-endian 32-bit unsigned integer to a Uint8Array.
 */
function writeUint32BE(data: Uint8Array, offset: number, value: number): void {
    data[offset] = (value >>> 24) & 0xFF
    data[offset + 1] = (value >>> 16) & 0xFF
    data[offset + 2] = (value >>> 8) & 0xFF
    data[offset + 3] = value & 0xFF
}

/**
 * Get the 4-character type of an MP4 atom at the given offset.
 */
function getAtomType(data: Uint8Array, offset: number): string {
    return String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7])
}

/**
 * Get atom size (handles both 32-bit and 64-bit extended sizes).
 * Returns { size, headerSize } where headerSize is 8 or 16.
 */
function getAtomSize(data: Uint8Array, offset: number): { size: number; headerSize: number } {
    const size32 = readUint32BE(data, offset)
    if (size32 === 1) {
        // 64-bit extended size (we read only lower 32 bits since JS numbers)
        // For files < 4GB this is fine
        const hi = readUint32BE(data, offset + 8)
        const lo = readUint32BE(data, offset + 12)
        return { size: hi * 0x100000000 + lo, headerSize: 16 }
    }
    if (size32 === 0) {
        // Atom extends to end of file
        return { size: data.length - offset, headerSize: 8 }
    }
    return { size: size32, headerSize: 8 }
}

/**
 * Find a child atom within a container atom.
 * Returns the offset of the child atom, or -1 if not found.
 */
function findAtom(data: Uint8Array, containerStart: number, containerEnd: number, type: string): number {
    let offset = containerStart
    while (offset < containerEnd - 8) {
        const { size } = getAtomSize(data, offset)
        if (size < 8) break
        if (getAtomType(data, offset) === type) return offset
        offset += size
    }
    return -1
}

/**
 * Find all top-level atoms and return their offsets and types.
 */
function findTopLevelAtoms(data: Uint8Array): Array<{ type: string; offset: number; size: number }> {
    const atoms: Array<{ type: string; offset: number; size: number }> = []
    let offset = 0
    while (offset < data.length - 8) {
        const { size } = getAtomSize(data, offset)
        if (size < 8) break
        const type = getAtomType(data, offset)
        atoms.push({ type, offset, size })
        offset += size
    }
    return atoms
}

/**
 * Read sample sizes from an `stsz` atom.
 * Returns array of sample sizes.
 */
function readSampleSizes(data: Uint8Array, stszOffset: number): number[] {
    const { headerSize } = getAtomSize(data, stszOffset)
    const base = stszOffset + headerSize
    // version(1) + flags(3) + sample_size(4) + sample_count(4)
    const uniformSize = readUint32BE(data, base + 4)
    const sampleCount = readUint32BE(data, base + 8)
    const sizes: number[] = []

    if (uniformSize > 0) {
        // All samples have the same size
        for (let i = 0; i < sampleCount; i++) sizes.push(uniformSize)
    } else {
        // Variable sizes — read each entry
        for (let i = 0; i < sampleCount; i++) {
            sizes.push(readUint32BE(data, base + 12 + i * 4))
        }
    }
    return sizes
}

/**
 * Read chunk offsets from `stco` (32-bit) or `co64` (64-bit) atom.
 */
function readChunkOffsets(data: Uint8Array, stcoOffset: number): number[] {
    const type = getAtomType(data, stcoOffset)
    const { headerSize } = getAtomSize(data, stcoOffset)
    const base = stcoOffset + headerSize
    const entryCount = readUint32BE(data, base + 4)
    const offsets: number[] = []

    if (type === 'co64') {
        for (let i = 0; i < entryCount; i++) {
            const hi = readUint32BE(data, base + 8 + i * 8)
            const lo = readUint32BE(data, base + 8 + i * 8 + 4)
            offsets.push(hi * 0x100000000 + lo)
        }
    } else {
        for (let i = 0; i < entryCount; i++) {
            offsets.push(readUint32BE(data, base + 8 + i * 4))
        }
    }
    return offsets
}

/**
 * Read sample-to-chunk mapping from `stsc` atom.
 * Returns array of { firstChunk, samplesPerChunk, descriptionIndex }.
 */
function readSampleToChunk(data: Uint8Array, stscOffset: number): Array<{ firstChunk: number; samplesPerChunk: number }> {
    const { headerSize } = getAtomSize(data, stscOffset)
    const base = stscOffset + headerSize
    const entryCount = readUint32BE(data, base + 4)
    const entries: Array<{ firstChunk: number; samplesPerChunk: number }> = []

    for (let i = 0; i < entryCount; i++) {
        entries.push({
            firstChunk: readUint32BE(data, base + 8 + i * 12),
            samplesPerChunk: readUint32BE(data, base + 8 + i * 12 + 4),
        })
    }
    return entries
}

/**
 * Read sync sample (keyframe) list from `stss` atom.
 * Returns set of 1-based sample numbers that are keyframes.
 * If no stss atom exists, all samples are keyframes.
 */
function readSyncSamples(data: Uint8Array, stblOffset: number, stblEnd: number): Set<number> | null {
    const stssOffset = findAtom(data, stblOffset + 8, stblEnd, 'stss')
    if (stssOffset === -1) return null // All samples are sync

    const { headerSize } = getAtomSize(data, stssOffset)
    const base = stssOffset + headerSize
    const entryCount = readUint32BE(data, base + 4)
    const syncSamples = new Set<number>()

    for (let i = 0; i < entryCount; i++) {
        syncSamples.add(readUint32BE(data, base + 8 + i * 4))
    }
    return syncSamples
}

/**
 * Compute byte offset and size of each sample from the MP4 sample tables.
 * Returns array of { offset, size } for each sample (0-indexed).
 */
function computeSampleOffsets(
    sampleSizes: number[],
    chunkOffsets: number[],
    stscEntries: Array<{ firstChunk: number; samplesPerChunk: number }>
): Array<{ offset: number; size: number }> {
    const result: Array<{ offset: number; size: number }> = []
    let sampleIdx = 0

    for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
        // Determine samplesPerChunk for this chunk (1-based chunk index)
        const chunkNum = chunkIdx + 1
        let samplesInThisChunk = stscEntries[0].samplesPerChunk
        for (let e = stscEntries.length - 1; e >= 0; e--) {
            if (chunkNum >= stscEntries[e].firstChunk) {
                samplesInThisChunk = stscEntries[e].samplesPerChunk
                break
            }
        }

        let offset = chunkOffsets[chunkIdx]
        for (let s = 0; s < samplesInThisChunk && sampleIdx < sampleSizes.length; s++) {
            const size = sampleSizes[sampleIdx]
            result.push({ offset, size })
            offset += size
            sampleIdx++
        }
    }

    return result
}

// Sampling frequency index table for ADTS header
const AAC_SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]

/**
 * Read AudioSpecificConfig from an esds atom to get AAC parameters.
 * Returns { objectType, sampleRateIndex, channelConfig } or null.
 */
function readAudioConfig(data: Uint8Array, stsdOffset: number, stsdEnd: number): {
    objectType: number
    sampleRateIndex: number
    channelConfig: number
} | null {
    // stsd contains sample entries. For AAC, the entry type is 'mp4a'.
    // Navigate: stsd → mp4a → esds
    const { headerSize } = getAtomSize(data, stsdOffset)
    const base = stsdOffset + headerSize
    // version(1) + flags(3) + entry_count(4) = 8 bytes
    const entryStart = base + 8

    if (entryStart + 8 > stsdEnd) return null

    // The sample entry for AAC:
    // size(4) + type(4='mp4a') + reserved(6) + data_ref_index(2) + reserved(8) + channelcount(2) + samplesize(2) + ...
    const entryType = String.fromCharCode(data[entryStart + 4], data[entryStart + 5], data[entryStart + 6], data[entryStart + 7])
    const entrySize = readUint32BE(data, entryStart)

    if (entryType !== 'mp4a' || entrySize < 36) {
        // Try to read channel count from mp4a header anyway
        // mp4a box: 8(header) + 6(reserved) + 2(data_ref) + 8(reserved) + 2(channels) + 2(samplesize) + 4(reserved) + 2(samplerate) + 2(pad)
        // Then child boxes like esds
    }

    // Read channelcount and samplerate from mp4a box directly
    // Offset within mp4a: +8(header) +6(reserved) +2(data_ref_idx) +8(reserved) = 24
    const channels = (data[entryStart + 24] << 8) | data[entryStart + 25]
    // samplerate is at +24+2+2+4 = +32, as 16.16 fixed point
    const sampleRate = readUint32BE(data, entryStart + 32) >>> 16

    // Find esds box within the mp4a entry
    let esdsOffset = -1
    let pos = entryStart + 36 // After mp4a fixed fields
    const entryEnd = entryStart + entrySize
    while (pos < entryEnd - 8) {
        const boxSize = readUint32BE(data, pos)
        const boxType = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7])
        if (boxSize < 8) break
        if (boxType === 'esds') {
            esdsOffset = pos
            break
        }
        pos += boxSize
    }

    // Default: try to figure out config from mp4a header
    let objectType = 2 // AAC-LC (most common)
    let sampleRateIndex = AAC_SAMPLE_RATES.indexOf(sampleRate)
    if (sampleRateIndex === -1) sampleRateIndex = 4 // default 44100
    let channelConfig = channels || 2

    if (esdsOffset !== -1) {
        // Parse esds to find AudioSpecificConfig
        // esds structure: full box header(12) + ES_Descriptor
        const esdsBase = esdsOffset + 12 // skip box header + version/flags
        // ES_Descriptor starts with tag 0x03, then size, then ESID(2) + flags(1)
        // Then DecoderConfigDescriptor (tag 0x04), then DecoderSpecificInfo (tag 0x05)
        // We search for tag 0x05 which contains AudioSpecificConfig
        for (let s = esdsBase; s < entryEnd - 5; s++) {
            if (data[s] === 0x05) {
                // Next byte(s) = size, then the AudioSpecificConfig (2+ bytes)
                let configOffset = s + 1
                // Read size (could be multi-byte)
                let size = data[configOffset]
                if (size === 0x80 || size === 0x81 || size === 0xFE) {
                    configOffset += 3 // skip extended size bytes
                } else {
                    configOffset += 1
                }
                if (configOffset + 2 <= entryEnd) {
                    // AudioSpecificConfig: 5 bits objectType + 4 bits freqIndex + 4 bits channelConfig
                    const byte0 = data[configOffset]
                    const byte1 = data[configOffset + 1]
                    objectType = (byte0 >> 3) & 0x1F
                    sampleRateIndex = ((byte0 & 0x07) << 1) | ((byte1 >> 7) & 0x01)
                    channelConfig = (byte1 >> 3) & 0x0F
                }
                break
            }
        }
    }

    console.log(`AAC config: objectType=${objectType}, sampleRate=${AAC_SAMPLE_RATES[sampleRateIndex] || '?'}, channels=${channelConfig}`)
    return { objectType, sampleRateIndex, channelConfig }
}

/**
 * Create a 7-byte ADTS header for one AAC frame.
 */
function makeAdtsHeader(frameLength: number, objectType: number, sampleRateIndex: number, channelConfig: number): Uint8Array {
    const header = new Uint8Array(7)
    const totalLength = frameLength + 7 // ADTS header + AAC frame

    // Byte 0: syncword high
    header[0] = 0xFF
    // Byte 1: syncword low(4) + ID(1)=0(MPEG-4) + layer(2)=00 + protection(1)=1(no CRC)
    header[1] = 0xF1
    // Byte 2: profile(2) + samplingFreqIdx(4) + private(1)=0 + channelConfig high(1)
    header[2] = ((objectType - 1) << 6) | (sampleRateIndex << 2) | ((channelConfig >> 2) & 0x01)
    // Byte 3: channelConfig low(2) + originality(1)=0 + home(1)=0 + copyrighted(1)=0 + copyright_start(1)=0 + frame_length high(2)
    header[3] = ((channelConfig & 0x03) << 6) | ((totalLength >> 11) & 0x03)
    // Byte 4: frame_length mid(8)
    header[4] = (totalLength >> 3) & 0xFF
    // Byte 5: frame_length low(3) + buffer_fullness high(5)
    header[5] = ((totalLength & 0x07) << 5) | 0x1F // 0x1F = VBR
    // Byte 6: buffer_fullness low(6) + num_raw_blocks(2)=00
    header[6] = 0xFC // 0xFC = rest of buffer_fullness (0x7FF) + 0 raw blocks

    return header
}

/**
 * Extract audio from MP4 and convert to AAC/ADTS format.
 * ADTS is a simple streaming format — no moov/atoms needed.
 * Then chunk the ADTS data into segments under maxChunkSize.
 */
/**
 * Helper: create an MP4 atom from type string and payload.
 */
function makeAtom(type: string, payload: Uint8Array): Uint8Array {
    const atom = new Uint8Array(8 + payload.length)
    writeUint32BE(atom, 0, atom.length)
    atom[4] = type.charCodeAt(0); atom[5] = type.charCodeAt(1)
    atom[6] = type.charCodeAt(2); atom[7] = type.charCodeAt(3)
    atom.set(payload, 8)
    return atom
}

/**
 * Helper: concatenate multiple Uint8Arrays.
 */
function concatArrays(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0)
    const result = new Uint8Array(total)
    let off = 0
    for (const a of arrays) { result.set(a, off); off += a.length }
    return result
}

/**
 * Build a minimal valid audio-only MP4 from scratch.
 * Creates: ftyp + moov (mvhd + trak with audio) + mdat
 * All sample table atoms are built correctly pointing to sequential mdat data.
 */
function buildMinimalAudioMP4(
    sampleSizes: number[],
    audioData: Uint8Array,
    stsdPayload: Uint8Array, // Original stsd atom content (includes sample descriptions)
    sttsPayload: Uint8Array, // Original stts atom content
    timescale: number,
    duration: number,
): Uint8Array {
    const numSamples = sampleSizes.length
    const totalAudioSize = audioData.length

    // === Build stbl (sample table) ===

    // stsd — copy from original (contains codec-specific info like esds)
    const stsd = stsdPayload

    // stts — copy from original (time-to-sample, defines duration per sample)
    const stts = sttsPayload

    // stsz — sample size table
    // version(1) + flags(3) + uniform_size(4) + count(4) + sizes(4*N)
    const stszData = new Uint8Array(12 + numSamples * 4)
    writeUint32BE(stszData, 0, 0) // version + flags
    writeUint32BE(stszData, 4, 0) // uniform_size = 0 (variable)
    writeUint32BE(stszData, 8, numSamples)
    for (let i = 0; i < numSamples; i++) {
        writeUint32BE(stszData, 12 + i * 4, sampleSizes[i])
    }
    const stsz = makeAtom('stsz', stszData)

    // stsc — sample-to-chunk: all samples in 1 chunk
    // version(1) + flags(3) + count(4) + entry(12)
    const stscData = new Uint8Array(16)
    writeUint32BE(stscData, 0, 0) // version + flags
    writeUint32BE(stscData, 4, 1) // 1 entry
    writeUint32BE(stscData, 8, 1) // first_chunk = 1
    writeUint32BE(stscData, 12, numSamples) // samples_per_chunk = all
    // description_index = 1 (already zero-initialized, need to set)
    // Wait, stsc entry is 12 bytes: first_chunk(4) + samples_per_chunk(4) + description_index(4)
    const stscDataFull = new Uint8Array(20)
    writeUint32BE(stscDataFull, 0, 0) // version + flags
    writeUint32BE(stscDataFull, 4, 1) // 1 entry
    writeUint32BE(stscDataFull, 8, 1) // first_chunk
    writeUint32BE(stscDataFull, 12, numSamples) // samples_per_chunk
    writeUint32BE(stscDataFull, 16, 1) // sample_description_index
    const stsc = makeAtom('stsc', stscDataFull)

    // stco — chunk offset table (1 entry, will be patched after we know the mdat offset)
    // version(1) + flags(3) + count(4) + offset(4)
    const stcoData = new Uint8Array(12)
    writeUint32BE(stcoData, 0, 0) // version + flags
    writeUint32BE(stcoData, 4, 1) // 1 entry
    writeUint32BE(stcoData, 8, 0) // placeholder, will be patched
    const stco = makeAtom('stco', stcoData)

    const stbl = makeAtom('stbl', concatArrays(stsd, stts, stsz, stsc, stco))

    // === Build minf ===
    // smhd (sound media header): version(1) + flags(3) + balance(2) + reserved(2)
    const smhdData = new Uint8Array(8)
    const smhd = makeAtom('smhd', smhdData)

    // dinf → dref (data reference, 1 entry pointing to self)
    const drefEntryData = new Uint8Array(4)
    writeUint32BE(drefEntryData, 0, 0x00000001) // flags = 1 (self-contained)
    const drefEntry = makeAtom('url ', drefEntryData)
    const drefData = concatArrays(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), drefEntry) // version+flags + count=1
    const dref = makeAtom('dref', drefData)
    const dinf = makeAtom('dinf', dref)

    const minf = makeAtom('minf', concatArrays(smhd, dinf, stbl))

    // === Build mdia ===
    // mdhd (media header): version(1) + flags(3) + creation(4) + modification(4) + timescale(4) + duration(4) + lang(2) + quality(2)
    const mdhdData = new Uint8Array(24)
    writeUint32BE(mdhdData, 8, timescale)
    writeUint32BE(mdhdData, 12, duration)
    mdhdData[16] = 0x55; mdhdData[17] = 0xC4 // language: 'und' (undetermined)
    const mdhd = makeAtom('mdhd', mdhdData)

    // hdlr (handler): version(1) + flags(3) + pre_defined(4) + handler_type(4) + reserved(12) + name(variable)
    const hdlrPayload = new Uint8Array(25)
    hdlrPayload[8] = 0x73; hdlrPayload[9] = 0x6F; hdlrPayload[10] = 0x75; hdlrPayload[11] = 0x6E // "soun"
    hdlrPayload[24] = 0 // null-terminated name
    const hdlr = makeAtom('hdlr', hdlrPayload)

    const mdia = makeAtom('mdia', concatArrays(mdhd, hdlr, minf))

    // === Build trak ===
    // tkhd (track header): version(1) + flags(3) + creation(4) + modification(4) + track_id(4) + reserved(4) + duration(4) + ...
    const tkhdData = new Uint8Array(84)
    tkhdData[3] = 0x03 // flags = track_enabled | track_in_movie
    writeUint32BE(tkhdData, 12, 1) // track_id = 1
    writeUint32BE(tkhdData, 20, duration) // duration
    // volume at offset 36: 0x0100 = full volume
    tkhdData[36] = 0x01; tkhdData[37] = 0x00
    // unity matrix at offset 40
    writeUint32BE(tkhdData, 40, 0x00010000)
    writeUint32BE(tkhdData, 56, 0x00010000)
    writeUint32BE(tkhdData, 72, 0x40000000)
    const tkhd = makeAtom('tkhd', tkhdData)

    const trak = makeAtom('trak', concatArrays(tkhd, mdia))

    // === Build moov ===
    // mvhd: version(1) + flags(3) + creation(4) + modification(4) + timescale(4) + duration(4) + rate(4) + volume(2) + reserved(10) + matrix(36) + pre_defined(24) + next_track_id(4)
    const mvhdData = new Uint8Array(100)
    writeUint32BE(mvhdData, 8, timescale) // timescale
    writeUint32BE(mvhdData, 12, duration) // duration
    writeUint32BE(mvhdData, 16, 0x00010000) // rate = 1.0
    mvhdData[20] = 0x01; mvhdData[21] = 0x00 // volume = 1.0
    // matrix (identity)
    writeUint32BE(mvhdData, 32, 0x00010000)
    writeUint32BE(mvhdData, 48, 0x00010000)
    writeUint32BE(mvhdData, 64, 0x40000000)
    writeUint32BE(mvhdData, 96, 2) // next_track_id
    const mvhd = makeAtom('mvhd', mvhdData)

    const moov = makeAtom('moov', concatArrays(mvhd, trak))

    // === Build ftyp ===
    const ftypPayload = new Uint8Array(12)
    // major_brand = 'M4A '
    ftypPayload[0] = 0x4D; ftypPayload[1] = 0x34; ftypPayload[2] = 0x41; ftypPayload[3] = 0x20
    // minor_version = 0
    // compatible_brands = 'isom'
    ftypPayload[8] = 0x69; ftypPayload[9] = 0x73; ftypPayload[10] = 0x6F; ftypPayload[11] = 0x6D
    const ftyp = makeAtom('ftyp', ftypPayload)

    // === Build mdat ===
    const mdatHeader = new Uint8Array(8)
    writeUint32BE(mdatHeader, 0, 8 + totalAudioSize)
    mdatHeader[4] = 0x6D; mdatHeader[5] = 0x64; mdatHeader[6] = 0x61; mdatHeader[7] = 0x74

    // === Assemble and patch stco ===
    const result = concatArrays(ftyp, moov, mdatHeader, audioData)

    // Patch stco: mdat data starts at ftyp.length + moov.length + 8 (mdat header)
    const mdatDataOffset = ftyp.length + moov.length + 8

    // Find stco in the result to patch it
    // stco is inside: ftyp + moov → mvhd → trak → mdia → minf → stbl → stco
    // Search for 'stco' atom in the result
    for (let i = 0; i < result.length - 12; i++) {
        if (result[i + 4] === 0x73 && result[i + 5] === 0x74 && result[i + 6] === 0x63 && result[i + 7] === 0x6F) { // "stco"
            // Patch the offset entry: at i + 8 (atom header) + 4 (version/flags) + 4 (count) = i + 16
            writeUint32BE(result, i + 16, mdatDataOffset)
            break
        }
    }

    return result
}

/**
 * Extract audio from MP4 video and create valid audio-only MP4 file(s).
 * Builds a proper MP4 container from scratch with correct atom structure.
 */
function chunkMP4(data: Uint8Array, maxChunkSize: number): Uint8Array[] {
    const topAtoms = findTopLevelAtoms(data)
    const moovAtom = topAtoms.find(a => a.type === 'moov')

    if (!moovAtom) {
        console.warn('MP4 missing moov atom')
        return [data]
    }

    const moovStart = moovAtom.offset
    const moovEnd = moovAtom.offset + moovAtom.size

    // Find audio trak
    let audioTrakOffset = -1
    let audioTrakEnd = -1
    let offset = moovStart + 8
    while (offset < moovEnd - 8) {
        const { size } = getAtomSize(data, offset)
        if (size < 8) break
        if (getAtomType(data, offset) === 'trak') {
            const trakEnd = offset + size
            const mdiaOff = findAtom(data, offset + 8, trakEnd, 'mdia')
            if (mdiaOff !== -1) {
                const mdiaEnd = mdiaOff + getAtomSize(data, mdiaOff).size
                const hdlrOff = findAtom(data, mdiaOff + 8, mdiaEnd, 'hdlr')
                if (hdlrOff !== -1) {
                    const { headerSize: hh } = getAtomSize(data, hdlrOff)
                    const ht = String.fromCharCode(data[hdlrOff + hh + 8], data[hdlrOff + hh + 9], data[hdlrOff + hh + 10], data[hdlrOff + hh + 11])
                    if (ht === 'soun') {
                        audioTrakOffset = offset
                        audioTrakEnd = trakEnd
                        break
                    }
                }
            }
        }
        offset += size
    }

    if (audioTrakOffset === -1) {
        console.warn('MP4: no audio trak found')
        return [data]
    }

    // Navigate to stbl and read all needed atoms
    const mdiaOff = findAtom(data, audioTrakOffset + 8, audioTrakEnd, 'mdia')
    if (mdiaOff === -1) return [data]
    const mdiaEnd = mdiaOff + getAtomSize(data, mdiaOff).size

    // Read timescale and duration from mdhd
    const mdhdOff = findAtom(data, mdiaOff + 8, mdiaEnd, 'mdhd')
    let timescale = 48000
    let mediaDuration = 0
    if (mdhdOff !== -1) {
        const { headerSize: mhh } = getAtomSize(data, mdhdOff)
        const mdhdBase = mdhdOff + mhh
        const version = data[mdhdBase]
        if (version === 0) {
            timescale = readUint32BE(data, mdhdBase + 12)
            mediaDuration = readUint32BE(data, mdhdBase + 16)
        } else {
            timescale = readUint32BE(data, mdhdBase + 20)
            // 64-bit duration — read lower 32 bits
            mediaDuration = readUint32BE(data, mdhdBase + 28)
        }
    }

    const minfOff = findAtom(data, mdiaOff + 8, mdiaEnd, 'minf')
    if (minfOff === -1) return [data]
    const minfEnd = minfOff + getAtomSize(data, minfOff).size
    const stblOff = findAtom(data, minfOff + 8, minfEnd, 'stbl')
    if (stblOff === -1) return [data]
    const stblEnd = stblOff + getAtomSize(data, stblOff).size

    // Read sample tables
    const stszOff = findAtom(data, stblOff + 8, stblEnd, 'stsz')
    const stcoOff = findAtom(data, stblOff + 8, stblEnd, 'stco')
    const co64Off = findAtom(data, stblOff + 8, stblEnd, 'co64')
    const stscOff = findAtom(data, stblOff + 8, stblEnd, 'stsc')
    const stsdOff = findAtom(data, stblOff + 8, stblEnd, 'stsd')
    const sttsOff = findAtom(data, stblOff + 8, stblEnd, 'stts')

    if (stszOff === -1 || stscOff === -1 || (stcoOff === -1 && co64Off === -1) || stsdOff === -1 || sttsOff === -1) {
        console.warn('MP4: missing required sample table atoms')
        return [data]
    }

    // Copy stsd and stts from original (they contain codec info and timing)
    const stsdSize = getAtomSize(data, stsdOff).size
    const stsdAtom = data.slice(stsdOff, stsdOff + stsdSize)
    const sttsSize = getAtomSize(data, sttsOff).size
    const sttsAtom = data.slice(sttsOff, sttsOff + sttsSize)

    const sampleSizes = readSampleSizes(data, stszOff)
    const chunkOffsetsArr = readChunkOffsets(data, stcoOff !== -1 ? stcoOff : co64Off)
    const stscEntries = readSampleToChunk(data, stscOff)
    const sampleOffsets = computeSampleOffsets(sampleSizes, chunkOffsetsArr, stscEntries)

    if (sampleOffsets.length === 0) return [data]

    // Extract all audio samples sequentially
    const totalAudioSize = sampleSizes.reduce((sum, s) => sum + s, 0)
    console.log(`MP4: found ${sampleOffsets.length} audio samples, ${(totalAudioSize / 1024 / 1024).toFixed(1)}MB audio data`)

    const audioData = new Uint8Array(totalAudioSize)
    let writePos = 0
    for (const { offset: sOff, size: sSize } of sampleOffsets) {
        audioData.set(data.subarray(sOff, sOff + sSize), writePos)
        writePos += sSize
    }

    // Build valid audio-only MP4
    const mp4 = buildMinimalAudioMP4(sampleSizes, audioData, stsdAtom, sttsAtom, timescale, mediaDuration)
    console.log(`MP4: built audio-only MP4: ${(mp4.length / 1024 / 1024).toFixed(1)}MB`)

    if (mp4.length <= maxChunkSize) {
        return [mp4]
    }

    // Audio-only MP4 still too large — convert to ADTS (streaming AAC) and chunk
    // ADTS is a simple frame-based format that can be split at any frame boundary

    const audioConfig = readAudioConfig(data, stsdOff, stsdOff + stsdSize)
    if (!audioConfig) {
        console.warn('MP4: cannot read AAC config for ADTS conversion, returning single chunk')
        return [mp4]
    }

    const { objectType, sampleRateIndex, channelConfig } = audioConfig

    // Build ADTS stream: each sample gets a 7-byte ADTS header
    let adtsTotalSize = 0
    for (const size of sampleSizes) adtsTotalSize += 7 + size
    const adtsData = new Uint8Array(adtsTotalSize)
    let adtsWritePos = 0
    let sampleReadPos = 0
    for (const size of sampleSizes) {
        const header = makeAdtsHeader(size, objectType, sampleRateIndex, channelConfig)
        adtsData.set(header, adtsWritePos)
        adtsData.set(audioData.subarray(sampleReadPos, sampleReadPos + size), adtsWritePos + 7)
        adtsWritePos += 7 + size
        sampleReadPos += size
    }

    // Split ADTS at frame boundaries (each frame = 7-byte header + AAC data)
    const adtsChunks: Uint8Array[] = []
    let chunkStartByte = 0
    let chunkAccum = 0

    for (let i = 0; i < sampleSizes.length; i++) {
        const frameSize = 7 + sampleSizes[i]
        if (chunkAccum + frameSize > maxChunkSize && chunkAccum > 0) {
            adtsChunks.push(adtsData.slice(chunkStartByte, chunkStartByte + chunkAccum))
            chunkStartByte += chunkAccum
            chunkAccum = 0
        }
        chunkAccum += frameSize
    }
    if (chunkAccum > 0) {
        adtsChunks.push(adtsData.slice(chunkStartByte, chunkStartByte + chunkAccum))
    }
    return adtsChunks
}

// ==================== PUBLIC API ====================

/**
 * Detect media type from content-type string.
 */
type MediaFormat = 'webm' | 'mp3' | 'wav' | 'mp4' | 'unknown'

function detectFormat(contentType: string): MediaFormat {
    const ct = contentType.toLowerCase()
    if (ct.includes('webm')) return 'webm'
    if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3'
    if (ct.includes('wav') || ct.includes('wave')) return 'wav'
    if (ct.includes('mp4') || ct.includes('m4a') || ct.includes('video/mp4')) return 'mp4'
    return 'unknown'
}

/**
 * Detect media format from URL extension as fallback when content-type is unhelpful.
 */
function detectFormatFromUrl(url: string): MediaFormat {
    try {
        const pathname = new URL(url).pathname.toLowerCase()
        if (pathname.endsWith('.webm')) return 'webm'
        if (pathname.endsWith('.mp3')) return 'mp3'
        if (pathname.endsWith('.wav')) return 'wav'
        if (pathname.endsWith('.mp4') || pathname.endsWith('.m4a')) return 'mp4'
    } catch { /* ignore invalid URLs */ }
    return 'unknown'
}

/**
 * Detect format from file magic bytes as final fallback.
 */
function detectFormatFromBytes(data: Uint8Array): MediaFormat {
    if (data.length < 12) return 'unknown'
    // RIFF....WAVE = WAV
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data[8] === 0x57 && data[9] === 0x41 && data[10] === 0x56 && data[11] === 0x45) return 'wav'
    // ID3 or 0xFFE0+ sync = MP3
    if ((data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) ||
        (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0)) return 'mp3'
    // 0x1A45DFA3 = EBML (WebM/Matroska)
    if (data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) return 'webm'
    // ftyp at offset 4 = MP4
    if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return 'mp4'
    return 'unknown'
}

/**
 * Get file extension for a media format.
 */
export function getFileExtension(contentType: string, sourceUrl?: string): string {
    let format = detectFormat(contentType)
    if (format === 'unknown' && sourceUrl) {
        format = detectFormatFromUrl(sourceUrl)
    }
    switch (format) {
        case 'webm': return 'webm'
        case 'mp3': return 'mp3'
        case 'wav': return 'wav'
        case 'mp4': return 'mp4'
        default: return 'mp3'
    }
}

/**
 * Chunk a media file into valid segments under the size limit.
 *
 * @param buffer - The full file as an ArrayBuffer
 * @param contentType - MIME type of the file
 * @param maxChunkSize - Maximum size per chunk in bytes (default 24MB)
 * @returns Array of ArrayBuffers, each a valid media file under maxChunkSize.
 *          Returns single-element array if file is already small enough.
 */
export function chunkMediaFile(
    buffer: ArrayBuffer,
    contentType: string,
    maxChunkSize: number = DEFAULT_MAX_CHUNK_SIZE,
    sourceUrl?: string
): ArrayBuffer[] {
    const data = new Uint8Array(buffer)

    // If already under the limit, return as-is
    if (data.length <= maxChunkSize) {
        return [buffer]
    }

    // Detect format with fallback chain: content-type → URL extension → magic bytes
    let format = detectFormat(contentType)
    if (format === 'unknown' && sourceUrl) {
        format = detectFormatFromUrl(sourceUrl)
        if (format !== 'unknown') {
            console.log(`[CHUNKER] Content-type "${contentType}" unhelpful, detected ${format} from URL`)
        }
    }
    if (format === 'unknown') {
        format = detectFormatFromBytes(data)
        if (format !== 'unknown') {
            console.log(`[CHUNKER] Detected ${format} from file magic bytes`)
        }
    }
    console.log(`Chunking ${format} file: ${(data.length / 1024 / 1024).toFixed(1)}MB into <${(maxChunkSize / 1024 / 1024).toFixed(0)}MB chunks`)

    let chunks: Uint8Array[]

    switch (format) {
        case 'webm':
            chunks = chunkWebM(data, maxChunkSize)
            break
        case 'mp3':
            chunks = chunkMP3(data, maxChunkSize)
            break
        case 'wav':
            chunks = chunkWAV(data, maxChunkSize)
            break
        case 'mp4':
            chunks = chunkMP4(data, maxChunkSize)
            break
        default:
            console.warn(`Unknown format "${contentType}" — sending full file`)
            return [buffer]
    }

    console.log(`Split into ${chunks.length} chunks: ${chunks.map(c => `${(c.length / 1024 / 1024).toFixed(1)}MB`).join(', ')}`)
    return chunks.map(c => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer)
}
