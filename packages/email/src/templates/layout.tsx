import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f1ea", fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: 32, maxWidth: 480 }}>
          <Heading as="h1" style={{ fontSize: 20, margin: "0 0 24px", color: "#1a1a1a" }}>
            Medivi Shop
          </Heading>
          <Section>{children}</Section>
          <Text style={{ fontSize: 12, color: "#8a8a8a", marginTop: 32 }}>
            Gear for adventurers — swords, armor, relics, and more.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
