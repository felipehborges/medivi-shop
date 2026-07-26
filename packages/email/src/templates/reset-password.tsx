import { Button, Text } from "@react-email/components";

import { EmailLayout } from "./layout";

export type ResetPasswordEmailProps = {
  name: string;
  resetUrl: string;
};

export function ResetPasswordEmail({ name, resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Reset your Medivi Shop password">
      <Text style={{ fontSize: 16 }}>Hi {name},</Text>
      <Text style={{ color: "#4a4a4a" }}>We received a request to reset your password. This link expires in 1 hour.</Text>
      <Button
        href={resetUrl}
        style={{ backgroundColor: "#1a1a1a", color: "#ffffff", padding: "12px 20px", borderRadius: 6, marginTop: 16 }}
      >
        Reset password
      </Button>
      <Text style={{ fontSize: 12, color: "#8a8a8a", marginTop: 16 }}>
        If you didn&apos;t request this, you can ignore this email — your password won&apos;t change.
      </Text>
    </EmailLayout>
  );
}
