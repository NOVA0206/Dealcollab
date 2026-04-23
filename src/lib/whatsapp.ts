export async function sendWhatsAppOTP(phone: string, otp: string) {
  console.log(`OTP ${otp} sent to ${phone}`);
  return { success: true };
}
