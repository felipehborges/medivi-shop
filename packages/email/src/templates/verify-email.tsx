import { Button, Text } from "@react-email/components";

import { EmailLayout } from "./layout";

export type VerifyEmailEmailProps = {
  name: string;
  verifyUrl: string;
};

export function VerifyEmailEmail({ name, verifyUrl }: VerifyEmailEmailProps) {
  return (
    <EmailLayout preview="Verify your Medivi Shop email address">
      <Text style={{ fontSize: 16 }}>Hi {name},</Text>
      <Text style={{ color: "#4a4a4a" }}>Confirm this is your email address to finish setting up your account.</Text>
      <Button
        href={verifyUrl}
        style={{ backgroundColor: "#1a1a1a", color: "#ffffff", padding: "12px 20px", borderRadius: 6, marginTop: 16 }}
      >
        Verify email
      </Button>
      <Text style={{ fontSize: 12, color: "#8a8a8a", marginTop: 16 }}>
        If you didn&apos;t create this account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
