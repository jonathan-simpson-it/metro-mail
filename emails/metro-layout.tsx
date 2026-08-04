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
/* MetroMail — JS&C branded email layout                                */
/* Cream canvas, dark-stamp logo, Georgia wordmark, sage hairlines.     */
/* Body copy: Inter/Helvetica stack (readable — never Georgia).         */
/* ------------------------------------------------------------------ */

const CREAM = "#f4f4ef";
const PAPER = "#ffffff";
const INK = "#161714";
const MUTED = "#5c5e56";
const LINE = "#d6d8d1";
const SAGE = "#80988f";

const body: React.CSSProperties = {
  margin: 0,
  padding: "24px 0",
  backgroundColor: CREAM,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: 600,
  margin: "0 auto",
  backgroundColor: PAPER,
  border: `1px solid ${LINE}`,
  borderRadius: 8,
};

const header: React.CSSProperties = {
  padding: "28px 32px 22px",
};

const wordmark: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', Times, serif",
  fontSize: 19,
  lineHeight: 1.2,
  letterSpacing: "2.5px",
  textTransform: "uppercase",
  color: INK,
  margin: 0,
};

const wordmarkSub: React.CSSProperties = {
  fontSize: 10,
  lineHeight: 1.4,
  letterSpacing: "2px",
  textTransform: "uppercase",
  color: SAGE,
  marginTop: 5,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const rule: React.CSSProperties = {
  borderColor: LINE,
  margin: "0 32px",
};

const contentSection: React.CSSProperties = {
  padding: "30px 32px 34px",
};

const content: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.65,
  color: INK,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
};

const footer: React.CSSProperties = {
  padding: "26px 32px 30px",
  textAlign: "center" as const,
};

const footerLinks: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  color: SAGE,
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
  color: SAGE,
  textDecoration: "none",
};

const brandLinkStyle: React.CSSProperties = {
  ...linkStyle,
  color: MUTED,
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
          {/* Header — official dark-stamp logo + serif wordmark */}
          <Section style={header}>
            <Row>
              <Column width={64} valign="middle">
                <Img
                  src={site.emailLogoUrl}
                  alt={site.name}
                  width={48}
                  height={48}
                  style={{ borderRadius: 4 }}
                />
              </Column>
              <Column>
                <Heading as="h1" style={wordmark}>
                  {site.name}
                </Heading>
                <Text style={wordmarkSub}>
                  {site.productName} · Corporate Communications
                </Text>
              </Column>
            </Row>
          </Section>

          <Hr style={rule} />

          {/* Body — composed content */}
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

          <Hr style={rule} />

          {/* Footer — site links + legal */}
          <Section style={footer}>
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
              © {new Date().getFullYear()} {site.name}. All rights reserved.
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
