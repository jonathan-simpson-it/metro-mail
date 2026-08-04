import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { site } from "@/lib/site";

/* ------------------------------------------------------------------ */
/* MetroMail - JS&C branded email layout (v2)                           */
/* Ink letterhead band mirrors the app header: dark-stamp logo chip,    */
/* Georgia wordmark, sage hairlines. Body: Inter (readable - never      */
/* Georgia for paragraphs). Cream canvas so the white card reads as     */
/* stationery. Every send is instantly recognizable as JS&C.            */
/* ------------------------------------------------------------------ */

const CREAM = "#f4f4ef";
const PAPER = "#ffffff";
const INK = "#161714";
const INK_BAND = "#121212";
const MUTED = "#5c5e56";
const LINE = "#d6d8d1";
const SAGE = "#80988f";
const SAGE_TEXT = "#5f7067";

const body: React.CSSProperties = {
  margin: 0,
  padding: "28px 0",
  backgroundColor: CREAM,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 600,
  margin: "0 auto",
  backgroundColor: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  overflow: "hidden",
};

/* ---------- Ink letterhead header ---------- */

const headerBand: React.CSSProperties = {
  backgroundColor: INK_BAND,
  padding: "26px 32px 24px",
};

const logoChip: React.CSSProperties = {
  backgroundColor: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 3,
  padding: 3,
  lineHeight: 0,
};

const footerLogoChip: React.CSSProperties = {
  backgroundColor: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: 3,
  padding: 3,
  lineHeight: 0,
};

const wordmark: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', Times, serif",
  fontSize: 19,
  lineHeight: 1.2,
  letterSpacing: "3px",
  textTransform: "uppercase",
  color: "#ffffff",
  margin: 0,
};

const wordmarkSub: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1.4,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: SAGE,
  marginTop: 6,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const headerRule: React.CSSProperties = {
  borderColor: SAGE,
  margin: 0,
};

/* ---------- Body ---------- */

const contentSection: React.CSSProperties = {
  padding: "30px 32px 34px",
};

const content: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: INK,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

/* ---------- Footer (cream band inside the card) ---------- */

const footer: React.CSSProperties = {
  padding: "28px 32px 32px",
  textAlign: "center" as const,
  backgroundColor: CREAM,
};

const footerLogoRow: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: 14,
};

const footerLinks: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: SAGE_TEXT,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const footerMeta: React.CSSProperties = {
  fontSize: 12,
  color: MUTED,
  lineHeight: 1.6,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const footerTag: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: MUTED,
  marginTop: 12,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const linkStyle: React.CSSProperties = {
  color: SAGE_TEXT,
  textDecoration: "none",
};

const brandLinkStyle: React.CSSProperties = {
  color: MUTED,
  textDecoration: "none",
};

export function MetroEmailLayout({
  previewText = "Jonathan Simpson & Co.",
  children,
  contentHtml,
}: {
  previewText?: string;
  children?: React.ReactNode;
  contentHtml?: string;
}) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Ink letterhead: logo chip + Georgia wordmark + sage rule */}
          <Section style={headerBand}>
            <Row>
              <Column width={62} valign="middle">
                <Img
                  src={site.emailLogoUrl}
                  alt={site.name}
                  width={36}
                  height={36}
                  style={logoChip}
                />
              </Column>
              <Column>
                <Heading as="h1" style={wordmark}>
                  {site.name}
                </Heading>
                <Text style={wordmarkSub}>
                  {site.productName} · Automation Systems &amp; Internal Tools
                </Text>
              </Column>
            </Row>
          </Section>
          <Hr style={headerRule} />

          {/* Body: composed content */}
          <Section style={contentSection}>
            {contentHtml ? (
              <div
                style={content}
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
            ) : (
              <div style={content}>{children}</div>
            )}
          </Section>

          <Hr style={{ borderColor: LINE, margin: "0 32px" }} />

          {/* Footer: logo mark, site links, legal */}
          <Section style={footer}>
            <Row style={footerLogoRow}>
              <Column align="center">
                <Img
                  src={site.emailLogoUrl}
                  alt={site.name}
                  width={26}
                  height={26}
                  style={footerLogoChip}
                />
              </Column>
            </Row>
            <Text style={footerLinks}>
              <Link href={site.website} style={linkStyle}>
                jonathansimpson.co
              </Link>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <Link href={site.linkedin} style={linkStyle}>
                LinkedIn
              </Link>
              &nbsp;&nbsp;·&nbsp;&nbsp;
              <Link href={site.contact} style={linkStyle}>
                Contact
              </Link>
            </Text>
            <Text style={footerMeta}>
              © {new Date().getFullYear()} {site.name.replace(/\.$/, "")}. All rights reserved.
              <br />
              <Link href={site.website} style={brandLinkStyle}>
                {site.website.replace("https://", "")}
              </Link>
            </Text>
            <Text style={footerTag}>
              {site.productName.toUpperCase()} · SECURE DELIVERY
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default MetroEmailLayout;
