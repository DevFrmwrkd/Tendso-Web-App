"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TestGroqPage() {
    const [submissionId, setSubmissionId] = useState("")
    const [audioUrl, setAudioUrl] = useState("")
    const [transcript, setTranscript] = useState("")

    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const testTranscription = async () => {
        if (!audioUrl) {
            setError("Please enter an audio URL")
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioUrl }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setResult(data)
            setTranscript(data.transcript)
        } catch (err: any) {
            setError(err.message || 'Transcription failed')
        } finally {
            setLoading(false)
        }
    }

    const testContentExtraction = async () => {
        if (!transcript) {
            setError("Please transcribe audio first or enter transcript manually")
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch('/api/extract-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setResult(data)
        } catch (err: any) {
            setError(err.message || 'Content extraction failed')
        } finally {
            setLoading(false)
        }
    }

    const testFullProcessing = async () => {
        if (!submissionId) {
            setError("Please enter a submission ID")
            return
        }

        setLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch('/api/process-submission', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId }),
            })

            const data = await res.json()

            if (!res.ok) throw new Error(data.error)

            setResult(data)
        } catch (err: any) {
            setError(err.message || 'Processing failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Groq AI Testing</h1>
                    <p className="text-gray-600 mb-8">Test transcription, content extraction, and website generation</p>

                    {/* Test 1: Transcription */}
                    <div className="mb-8 p-6 bg-blue-50 rounded-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">1. Test Transcription</h2>
                        <div className="space-y-4">
                            <div>
                                <Label>Audio URL</Label>
                                <Input
                                    value={audioUrl}
                                    onChange={(e) => setAudioUrl(e.target.value)}
                                    placeholder="https://storage.url/audio.mp3"
                                    className="mt-1"
                                />
                            </div>
                            <Button
                                onClick={testTranscription}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? 'Transcribing...' : 'Transcribe Audio'}
                            </Button>
                        </div>
                    </div>

                    {/* Test 2: Content Extraction */}
                    <div className="mb-8 p-6 bg-amber-50 rounded-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">2. Test Content Extraction</h2>
                        <div className="space-y-4">
                            <div>
                                <Label>Transcript</Label>
                                <textarea
                                    value={transcript}
                                    onChange={(e) => setTranscript(e.target.value)}
                                    placeholder="Enter or paste transcript here..."
                                    className="w-full h-32 p-3 border border-gray-300 rounded-lg mt-1"
                                />
                            </div>
                            <Button
                                onClick={testContentExtraction}
                                disabled={loading}
                                className="w-full bg-amber-600 hover:bg-amber-700"
                            >
                                {loading ? 'Extracting...' : 'Extract Business Content'}
                            </Button>
                        </div>
                    </div>

                    {/* Test 3: Full Processing */}
                    <div className="mb-8 p-6 bg-purple-50 rounded-xl">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">3. Test Full Processing</h2>
                        <div className="space-y-4">
                            <div>
                                <Label>Submission ID</Label>
                                <Input
                                    value={submissionId}
                                    onChange={(e) => setSubmissionId(e.target.value)}
                                    placeholder="Enter submission UUID"
                                    className="mt-1"
                                />
                            </div>
                            <Button
                                onClick={testFullProcessing}
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {loading ? 'Processing...' : 'Process Submission (All Steps)'}
                            </Button>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-600 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Result Display */}
                    {result && (
                        <div className="p-6 bg-gray-100 rounded-xl">
                            <h3 className="text-lg font-bold text-gray-900 mb-3">Result:</h3>
                            <pre className="bg-white p-4 rounded-lg overflow-auto max-h-96 text-sm">
                                {JSON.stringify(result, null, 2)}
                            </pre>

                            {result.websiteUrl && (
                                <Button
                                    onClick={() => window.open(result.websiteUrl, '_blank')}
                                    className="mt-4 w-full"
                                >
                                    View Generated Website
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Documentation */}
                <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
                    <div className="space-y-4 text-gray-600">
                        <div>
                            <h3 className="font-semibold text-gray-900">Step 1: Transcription</h3>
                            <p>Uses Groq's Whisper model to convert audio/video to text</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Step 2: Content Extraction</h3>
                            <p>Uses LLaMA 3.3 to extract structured business information (tagline, services, contact, etc.)</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Step 3: Website Generation</h3>
                            <p>Uses LLaMA 3.3 to generate a beautiful, responsive website with Tailwind CSS</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">Full Processing</h3>
                            <p>Runs all three steps automatically for a submission</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
