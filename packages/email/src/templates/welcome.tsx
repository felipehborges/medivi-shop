import { Button, Text } from "@react-email/components";

import { EmailLayout } from "./layout";

export type WelcomeEmailProps = {
  name: string;
  shopUrl: string;
};

export function WelcomeEmail({ name, shopUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview="Welcome to Medivi Shop">
      <Text style={{ fontSize: 16 }}>Welcome, {name}!</Text>
      <Text style={{ color: "#4a4a4a" }}>
        Your account is ready. Swords, shields, and enchanted relics await.
      </Text>
      <Button
        href={shopUrl}
        style={{ backgroundColor: "#1a1a1a", color: "#ffffff", padding: "12px 20px", borderRadius: 6, marginTop: 16 }}
      >
        Start browsing
      </Button>
    </EmailLayout>
  );
}
