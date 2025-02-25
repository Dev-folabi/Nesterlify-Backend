import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';

interface MailOptions {
  email: string;
  subject: string;
  message: string;
}

const sendMail = async (options: MailOptions): Promise<void> => {
  const transporter: Transporter = nodemailer.createTransport({
    host: process.env.SMPT_HOST as string,
    port: Number(process.env.SMPT_PORT),
    secure: false,
    service: process.env.SMPT_SERVICE as string,
    auth: {
      user: process.env.SMPT_MAIL as string,
      pass: process.env.SMPT_PASSWORD as string,
    },

  });

  const mailOptions: SendMailOptions = {
    from: process.env.SMPT_MAIL as string,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
