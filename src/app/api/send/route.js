import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL;

export async function POST(req, res) {
  const { email, subject, message } = await req.json();
  console.log(email, subject, message);
  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to: [fromEmail,email, "naman.bhayana13@gmail.com"],
      subject: subject,
      react: (
        <>
          <div style={{ fontFamily: 'Arial, sans-serif', color: '#333', lineHeight: '1.6' }}>
            <h2 style={{ color: '#2c3e50' }}>📧 New Contact Request</h2>
            <p><strong>Subject:</strong> <span style={{ color: '#16a085' }}>{subject}</span></p>
      
            <div style={{
              backgroundColor: '#f4f6f8',
              padding: '15px',
              borderRadius: '8px',
              borderLeft: '5px solid #3498db',
              margin: '20px 0'
            }}>
              <p style={{ margin: 0 }}><strong>Message:</strong></p>
              <p style={{ margin: '10px 0 0' }}>{message}</p>
            </div>
      
            <p>This is an <strong>automated response</strong> to confirm I’ve received your message.</p>
            <p>Thank you for reaching out to me. I appreciate your message and will respond shortly.</p>
            
            <p style={{ marginTop: '30px' }}>
              Best regards,<br />
              <strong style={{ color: '#2c3e50' }}>Naman Bhayana</strong>
            </p>
          </div>
        </>
      )
      
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error });
  }
}
