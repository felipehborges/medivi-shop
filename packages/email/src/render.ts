import { render } from "@react-email/render";

import { OrderConfirmationEmail, type OrderConfirmationEmailProps } from "./templates/order-confirmation";
import { WelcomeEmail, type WelcomeEmailProps } from "./templates/welcome";
import { VerifyEmailEmail, type VerifyEmailEmailProps } from "./templates/verify-email";
import { ResetPasswordEmail, type ResetPasswordEmailProps } from "./templates/reset-password";

export type RenderedEmail = { subject: string; html: string };

export async function renderOrderConfirmationEmail(props: OrderConfirmationEmailProps): Promise<RenderedEmail> {
  return {
    subject: `Order confirmed — ${props.orderNumber}`,
    html: await render(OrderConfirmationEmail(props)),
  };
}

export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<RenderedEmail> {
  return {
    subject: "Welcome to Medivi Shop",
    html: await render(WelcomeEmail(props)),
  };
}

export async function renderVerifyEmailEmail(props: VerifyEmailEmailProps): Promise<RenderedEmail> {
  return {
    subject: "Verify your email address",
    html: await render(VerifyEmailEmail(props)),
  };
}

export async function renderResetPasswordEmail(props: ResetPasswordEmailProps): Promise<RenderedEmail> {
  return {
    subject: "Reset your password",
    html: await render(ResetPasswordEmail(props)),
  };
}
