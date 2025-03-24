import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { omit } from "lodash";
import User from "../models/user.model";
import { Activation, PasswordReset } from "../models/temporaryData";
import { sendMail } from "../utils/sendMail";
import { errorHandler } from "../middleware/errorHandler";
import Notification from "../models/notification.model";

// User Signup
export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, fullName, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return errorHandler(res, 400, "Passwords do not match.");
    }

    if (await User.findOne({ email })) {
      return errorHandler(res, 400, "Email already registered.");
    }

    if (await User.findOne({ username })) {
      return errorHandler(res, 400, "Username already taken.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const activationCode = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000);

    if (await Activation.findOne({ email })) {
      await Activation.deleteOne({ email });
    }

    if (await Activation.findOne({ username })) {
      await Activation.deleteOne({ username });
    }
    await Activation.create({
      email,
      fullName,
      username,
      password: hashedPassword,
      activationCode,
      expirationTime,
    });

    await sendMail({
      email,
      subject: "Account Activation Code",
      message: `Dear ${fullName},

  Thank you for registering with Nesterlify. To complete your registration, please use the following activation code:

  Activation Code: ${activationCode}

  Please note that this code will expire in 5 minutes. If you did not initiate this request, please disregard this email.

  Best regards,
  The Nesterlify Team`,
    });

    res.status(200).json({
      success: true,
      message: "User registered. Check email for activation code.",
    });
  } catch (error) {
    next(error);
  }
};

// Account Activation
export const activate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { activationCode } = req.body;
    const userPending = await Activation.findOne({ activationCode });

    if (!userPending || new Date() > userPending.expirationTime) {
      return errorHandler(res, 400, "Invalid or expired activation code.");
    }

    if (userPending.activationCode !== parseInt(activationCode)) {
      return errorHandler(res, 400, "Incorrect activation code.");
    }

    const newUser = await User.create(
      omit(userPending.toObject(), ["_id", "activationCode", "expirationTime"])
    );
    await Activation.deleteOne({ activationCode });

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" }
    );

    await sendMail({
      email: newUser.email,
      subject: "Welcome to Nesterlify!",
      message: `Dear ${newUser.fullName},

    Welcome to Nesterlify! Your account has been successfully activated.

    We are excited to have you on board. If you have any questions or need assistance, feel free to reach out to our support team.

    Best regards,
    The Nesterlify Team`,
    });

    res.status(200).json({
      success: true,
      message: "Account activated.",
      data: omit(newUser.toObject(), ["password"]),
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Resend Activation Code
export const resendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const userPending = await Activation.findOne({ email });

    if (!userPending) {
      return errorHandler(res, 400, "No pending activation request found.");
    }

    const activationCode = Math.floor(100000 + Math.random() * 900000);
    userPending.activationCode = activationCode;
    userPending.expirationTime = new Date(Date.now() + 5 * 60 * 1000);
    await userPending.save();

    await sendMail({
      email,
      subject: "New Activation Code",
      message: `Dear User,

  We have generated a new activation code for your account as per your request. Please find your new activation code below:

  Activation Code: ${activationCode}

  This code will expire in 5 minutes. If you did not request this code, please ignore this email.

  Best regards,
  The Nesterlify Team`,
    });

    res
      .status(200)
      .json({ success: true, message: "New activation code sent." });
  } catch (error) {
    next(error);
  }
};

// User Signin
export const signin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { emailOrUsername, password } = req.body;

    // Find user by email or username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return errorHandler(res, 400, "Invalid credentials.");
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorHandler(res, 400, "Invalid credentials.");
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET as string, {
      expiresIn: "1h",
    });

    res.status(200).json({
      success: true,
      message: "Signin successful.",
      data: omit(user.toObject(), ["password"]),
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Request Password Reset
export const requestPasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return errorHandler(res, 404, "User not found.");

    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000);

    await PasswordReset.updateOne(
      { email },
      { otpCode, expirationTime },
      { upsert: true }
    );

    await sendMail({
      email,
      subject: "Password Reset Request",
      message: `Dear ${user.firstName},

    We received a request to reset your password. Please use the following OTP code to reset your password:

    OTP Code: ${otpCode}

    This code will expire in 5 minutes. If you did not request a password reset, please ignore this email.

    Best regards,
    The Nesterlify Team`,
    });

    res
      .status(200)
      .json({ success: true, message: "OTP sent for password reset." });
  } catch (error) {
    next(error);
  }
};

// Verify OTP and Reset Password
export const verifyPasswordOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { otpCode, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      return errorHandler(res, 400, "Passwords do not match.");
    }

    const resetRequest = await PasswordReset.findOne({ otpCode });

    if (
      !resetRequest ||
      new Date() > resetRequest.expirationTime ||
      resetRequest.otpCode !== parseInt(otpCode)
    ) {
      return errorHandler(res, 400, "Invalid or expired OTP.");
    }
    const { email } = resetRequest;
    const user = await User.findOne({ email });
    if (!user) return errorHandler(res, 404, "User not found.");

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Start Transaction (Ensuring Atomicity)
    const session = await User.startSession();
    session.startTransaction();

    try {
      user.password = hashedPassword;
      await user.save({ session });
      await PasswordReset.deleteOne({ email });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }

    await Promise.all([
      sendMail({
        email,
        subject: "Password Reset Successful",
        message: `Dear ${user.fullName},

    Your password has been successfully reset. You can now log in with your new password.

    If you did not request this change, please contact our support team immediately.

    Best regards,
    The Nesterlify Team`,
      }),
      Notification.create({
        userId: user._id,
        title: "Password Reset",
        message: "Your password has been successfully reset.",
        category: "general",
      }),
    ]);

    res
      .status(200)
      .json({ success: true, message: "Password reset successful." });
  } catch (error) {
    next(error);
  }
};
