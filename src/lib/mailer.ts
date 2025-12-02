import { Resend } from "resend"; // Correcta importación de Resend

const resend = new Resend(process.env.RESEND_API_KEY); // Usar la API Key de Resend

export const sendVerificationEmail = async (to: string, code: string) => {
  const fromEmail = process.env.EMAIL_USER;

  // Verifica si el correo de "from" está presente
  if (!fromEmail) {
    throw new Error("EMAIL_USER is not defined in .env");
  }

  try {
    // Enviar correo usando Resend
    const response = await resend.emails.send({
      from: fromEmail, // El correo verificado en Resend
      to,
      subject: "Código de Verificación de UniPost",
      html: `
        <p>Tu código de verificación es: <strong>${code}</strong></p>
        <p>Este código es válido por 10 minutos.</p>
      `,
    });

    return response; // Si todo está bien, devuelve la respuesta de Resend
  } catch (error) {
    console.error("Error enviando el correo:", error);
    throw new Error("Error enviando el correo de verificación");
  }
};

export const sendPasswordResetEmail = async (to: string, code: string) => {
  const fromEmail = process.env.EMAIL_USER;

  if (!fromEmail) throw new Error("EMAIL_USER is not defined in .env");

  try {
    await resend.emails.send({
      from: fromEmail,
      to,
      subject: "Recuperación de contraseña - UniPost",
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2>Solicitud de cambio de contraseña</h2>
          <p>Has solicitado restablecer tu contraseña en UniPost. Usa el siguiente código:</p>
          <h1 style="color: #4F46E5; letter-spacing: 5px;">${code}</h1>
          <p>Este código expira en 10 minutos.</p>
          <p style="font-size: 12px; color: #666;">Si no solicitaste esto, ignora este correo.</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("Error enviando email de reset:", error);
    throw new Error("Error enviando el correo");
  }
};