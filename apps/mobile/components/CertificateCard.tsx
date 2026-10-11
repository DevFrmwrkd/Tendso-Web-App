import React, { forwardRef } from 'react';
import { View, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CertificateCardProps {
  creatorName: string;
  certMonth: string;
  certYear: number;
}

const CertificateCard = forwardRef<View, CertificateCardProps>(
  ({ creatorName, certMonth, certYear }, ref) => {
    return (
      <View
        ref={ref}
        collapsable={false}
        style={{
          width: '100%',
          backgroundColor: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: '#E4B05E',
        }}
      >
        {/* Gold top banner */}
        <View style={{
          backgroundColor: '#C89548',
          paddingVertical: 20,
          alignItems: 'center',
        }}>
          <Image
            source={require('../assets/tendso-icon.png')}
            style={{ width: 44, height: 44, borderRadius: 10, marginBottom: 8 }}
            resizeMode="contain"
          />
          <Text style={{
            fontFamily: 'GoogleSansFlex_700Bold',
            fontSize: 14, color: '#fff',
            letterSpacing: 3,
          }}>
            TENDSO
          </Text>
        </View>

        {/* Certificate body */}
        <View style={{
          paddingHorizontal: 28,
          paddingTop: 28,
          paddingBottom: 32,
          alignItems: 'center',
        }}>
          {/* Ribbon icon */}
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: '#FBF3E0',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Ionicons name="ribbon" size={26} color="#E4B05E" />
          </View>

          {/* Certificate title */}
          <Text style={{
            fontSize: 11, fontWeight: '700', color: '#a1a1aa',
            letterSpacing: 2, marginBottom: 6,
          }}>
            CERTIFICATE OF COMPLETION
          </Text>

          <Text style={{
            fontSize: 22, fontWeight: '900', color: '#18181b',
            textAlign: 'center', marginBottom: 4,
          }}>
            Certified Creator
          </Text>

          {/* Thin divider */}
          <View style={{
            width: 40, height: 3, backgroundColor: '#E4B05E',
            borderRadius: 2, marginVertical: 16,
          }} />

          {/* Description */}
          <Text style={{
            fontSize: 13, color: '#71717a', textAlign: 'center',
            lineHeight: 20, marginBottom: 20,
          }}>
            This certifies that
          </Text>

          {/* Creator name badge */}
          <View style={{
            backgroundColor: '#1e3a5f',
            borderRadius: 10,
            paddingHorizontal: 24,
            paddingVertical: 14,
            marginBottom: 20,
            minWidth: 180,
            alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 16, fontWeight: '900', color: '#fff',
              letterSpacing: 1, textAlign: 'center',
            }}>
              {creatorName || 'CERTIFIED CREATOR'}
            </Text>
          </View>

          {/* Body text */}
          <Text style={{
            fontSize: 13, color: '#52525b', textAlign: 'center',
            lineHeight: 20, marginBottom: 24, paddingHorizontal: 4,
          }}>
            has demonstrated proficiency in{' '}
            <Text style={{ fontWeight: '700', color: '#18181b' }}>
              Local Business Digitization
            </Text>
            {' '}and is authorized to provide verified digital services to MSMEs in the Philippines.
          </Text>

          {/* Date and divider */}
          <View style={{
            width: '100%',
            borderTopWidth: 1, borderTopColor: '#f4f4f5',
            paddingTop: 16, alignItems: 'center',
          }}>
            <Text style={{
              fontSize: 10, fontWeight: '700', color: '#a1a1aa',
              letterSpacing: 1.5, marginBottom: 4,
            }}>
              DATE ISSUED
            </Text>
            <Text style={{
              fontSize: 15, fontWeight: '700', color: '#18181b',
            }}>
              {certMonth} {certYear}
            </Text>
          </View>
        </View>

        {/* Gold bottom banner */}
        <View style={{
          backgroundColor: '#C89548',
          paddingVertical: 14,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 14, fontWeight: '800', color: '#fff',
            letterSpacing: 0.5,
          }}>
            You can now start earning!
          </Text>
        </View>
      </View>
    );
  }
);

export default CertificateCard;
