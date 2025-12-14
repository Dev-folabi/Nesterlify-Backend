import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import User from "../models/user.model";
import { CustomRequest } from "../middleware/verify";
import { errorHandler } from "../middleware/errorHandler";
import { sendMail } from "../utils/sendMail";
import { PasswordReset } from "../models/temporaryData";

// Get user details
export const getUser = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return errorHandler(res, 404, "User not found");

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Edit profile
export const editProfile = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: req.body },
      { new: true }
    ).select("-password");

    if (!updatedUser) return errorHandler(res, 404, "User not found");

    res.status(200).json({
      success: true,
      message: "Profile edited successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle 2FA
export const twoFA = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id);
    if (!user) return errorHandler(res, 404, "User not found");

    user.twoFa = req.body.twoFa;
    await user.save();

    res.status(200).json({
      success: true,
      message: "2-Factor authentication updated",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle email notifications
export const emailToggle = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id);
    if (!user) return errorHandler(res, 404, "User not found");

    user.emailNotification = req.body.emailToggle;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email notification updated",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle web notifications
export const webNotification = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id);
    if (!user) return errorHandler(res, 404, "User not found");

    if (!user.notificationSettings?.website) {
      return errorHandler(res, 400, "Notification settings not found");
    }

    const { bookings, cheapflight, transaction } = req.body;
    user.notificationSettings.website = {
      ...user.notificationSettings.website,
      bookings: bookings ?? user.notificationSettings.website.bookings,
      cheapflight: cheapflight ?? user.notificationSettings.website.cheapflight,
      transaction: transaction ?? user.notificationSettings.website.transaction,
    };

    await user.save();
    res.status(200).json({
      success: true,
      message: "Website notification settings updated",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Email notifications
export const emailNotification = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorHandler(res, 404, "User not found");
    }

    const { bookings, cheapflight, transaction } = req.body;

    user.notificationSettings.email.bookings =
      bookings ?? user.notificationSettings.email.bookings;
    user.notificationSettings.email.cheapflight =
      cheapflight ?? user.notificationSettings.email.cheapflight;
    user.notificationSettings.email.transaction =
      transaction ?? user.notificationSettings.email.transaction;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email notification settings updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Change password request
export const changePassword = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const { oldPassword, newPassword } = req.body;

  try {
    if (!req.user) return errorHandler(res, 401, "Unauthorized");
    const user = await User.findById(req.user.id);
    if (!user) return errorHandler(res, 404, "User not found.");
    const email = user.email;

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword)
      return errorHandler(res, 401, "Old password is incorrect");

    const otpCode = Math.floor(100000 + Math.random() * 900000);
    const expirationTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await PasswordReset.findOneAndUpdate(
      { email },
      {
        otpCode,
        expirationTime,
        newHashedPassword: hashedNewPassword,
      },
      { upsert: true, new: true }
    );

    await sendMail({
      email,
      subject: "Password Change Request - OTP Code",
      message: `Dear ${user.firstName},

  We have received a request to change the password for your account. Please use the following One-Time Password (OTP) to complete the process:

  OTP Code: ${otpCode}

  This code will expire in 5 minutes. If you did not request a password change, please ignore this email or contact our support team immediately.

  Best regards,
  The Support Team`,
    });

    res.status(200).json({ success: true, message: "OTP sent to your email" });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to initiate password change."));
  }
};

// Verify OTP and change password
export const verifyChangePasswordOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { otpCode } = req.body;

  try {
    const resetRequest = await PasswordReset.findOne({ otpCode });
    if (!resetRequest || resetRequest.expirationTime < new Date()) {
      return errorHandler(res, 400, "Invalid or expired OTP.");
    }

    if (resetRequest.otpCode !== Number(otpCode)) {
      return errorHandler(res, 400, "Invalid OTP code.");
    }
    const email = resetRequest.email;
    const user = await User.findOne({ email });
    if (!user) return errorHandler(res, 404, "User not found.");

    user.password = resetRequest.newHashedPassword;
    await user.save();
    await PasswordReset.deleteOne({ email });

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to change password."));
  }
};

// Get all users
export const users = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await User.find({});
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to fetch users."));
  }
};

// Delete user
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return errorHandler(res, 404, "User not found");

    res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to delete user."));
  }
};

// Get admins
export const admins = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("-password")
      .sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Admins retrieved successfully",
      count: admins.length,
      data: admins,
    });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to fetch admins."));
  }
};

// Block user
export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBlocked: true },
      { new: true }
    );
    if (!user) return errorHandler(res, 404, "User not found");

    res.status(200).json({
      success: true,
      message: "User blocked successfully",
      data: user,
    });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to block user."));
  }
};

// Delete selected users
export const deleteSelectedUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ids } = req.body;
    await User.deleteMany({ _id: { $in: ids } });
    res
      .status(200)
      .json({ success: true, message: "Selected users deleted successfully" });
  } catch (error) {
    next(errorHandler(res, 500, "Failed to delete users."));
  }
};
