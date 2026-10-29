import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

const ink = '#22201c'
const muted = '#5e5a51'
const accent = '#2f5d46'

export const styles = {
  h1: { fontFamily: 'Georgia, serif', fontSize: '28px', lineHeight: '1.2', fontWeight: 500, color: ink, margin: '0 0 12px' },
  p: { fontFamily: 'Georgia, serif', fontSize: '17px', lineHeight: '1.6', color: ink, margin: '0 0 16px' },
  muted: { fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '13px', lineHeight: '1.5', color: muted, margin: 0 },
  button: {
    display: 'inline-block',
    background: accent,
    color: '#ffffff',
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 600,
    fontSize: '15px',
    padding: '12px 20px',
    borderRadius: '10px',
    textDecoration: 'none',
  },
  link: { color: accent },
}

export function Layout({ preview, children, footer }: { preview: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ background: '#f6f3ec', margin: 0, padding: '32px 0' }}>
        <Container style={{ background: '#fcfbf7', borderRadius: '16px', padding: '32px', maxWidth: '560px' }}>
          <Text style={{ ...styles.muted, color: accent, fontWeight: 600, marginBottom: '20px' }}>
            c♪ Coder thích chơi đàn
          </Text>
          {children}
          <Hr style={{ borderColor: '#e0dacb', margin: '28px 0 16px' }} />
          <Section>
            {footer ?? (
              <Text style={styles.muted}>
                <Link href="https://coderthichchoidan.dev" style={styles.link}>
                  coderthichchoidan.dev
                </Link>
              </Text>
            )}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
