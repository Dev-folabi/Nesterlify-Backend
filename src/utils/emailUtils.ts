import { sendMail } from "./sendMail";
import Notification from "../models/notification.model";
import { IBooking } from "../types/models";
import logger from "./logger";

interface PaymentSuccessEmailParams {
  user: any;
  booking: IBooking;
  orderId: string;
}

export const sendPaymentSuccessEmail = async ({
  user,
  booking,
  orderId,
}: PaymentSuccessEmailParams) => {
  try {
    const bookingType = booking.bookingType;
    let bookingDetails = "";

    switch (bookingType) {
      case "flight":
        if (booking.flights && booking.flights.length > 0) {
          const flight = booking.flights[0];
          const itinerary = flight.itineraries[0];
          const firstSegment = itinerary.segments[0];
          const lastSegment = itinerary.segments[itinerary.segments.length - 1];

          bookingDetails = `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #333;">Flight Details</h3>
              <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${flight.flightOrderId || "Pending"}</p>
              <p style="margin: 5px 0;"><strong>From:</strong> ${firstSegment.departure.iataCode} at ${new Date(firstSegment.departure.at).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>To:</strong> ${lastSegment.arrival.iataCode} at ${new Date(lastSegment.arrival.at).toLocaleString()}</p>
              <p style="margin: 5px 0;"><strong>Airline:</strong> ${firstSegment.carrierCode} ${firstSegment.number}</p>
              <p style="margin: 5px 0;"><strong>Travelers:</strong> ${flight.travelers.length}</p>
            </div>
          `;
        }
        break;

      case "hotel":
        if (booking.hotel && booking.hotel.length > 0) {
          const hotel = booking.hotel[0];
          bookingDetails = `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #333;">Hotel Details</h3>
              <p style="margin: 5px 0;"><strong>Hotel Name:</strong> ${hotel.name || "N/A"}</p>
              <p style="margin: 5px 0;"><strong>Address:</strong> ${hotel.address?.line_one || ""}, ${hotel.address?.city_name || ""}, ${hotel.address?.country_code || ""}</p>
              <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${hotel.booking_id || "Pending"}</p>
              <p style="margin: 5px 0;"><strong>Hotel Quote ID:</strong> ${hotel.quote_id || "N/A"}</p>
              <p style="margin: 5px 0;"><strong>Check-in:</strong> ${hotel.check_in_date || "N/A"}</p>
              <p style="margin: 5px 0;"><strong>Check-out:</strong> ${hotel.check_out_date || "N/A"}</p>
              <p style="margin: 5px 0;"><strong>Guests:</strong> ${hotel.guests.length}</p>
              <p style="margin: 5px 0;"><strong>Rooms:</strong> ${hotel.rooms || 1}</p>
            </div>
          `;
        }
        break;

      case "car":
        if (booking.car && booking.car.length > 0) {
          const car = booking.car[0];
          const startAddress = car.start?.address;
          const endAddress = car.end?.address;
          const vehicle = car.vehicle;
          const provider = car.serviceProvider;

          bookingDetails = `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #333;">Car Transfer Details</h3>
               <p style="margin: 5px 0;"><strong>Confirmation Number:</strong> ${
                 car.confirmNbr || "Pending"
               }</p>
               <p style="margin: 5px 0;"><strong>Service Provider:</strong> ${
                 provider?.name || "N/A"
               }</p>
               
               <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                 <p style="margin: 5px 0;"><strong>Pickup:</strong> ${
                   startAddress?.line || ""
                 } ${startAddress?.cityName || ""} (${
                   car.start?.locationCode || ""
                 })</p>
                 <p style="margin: 5px 0;"><strong>Time:</strong> ${
                   car.start?.dateTime
                     ? new Date(car.start.dateTime).toLocaleString()
                     : "N/A"
                 }</p>
               </div>

               <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                 <p style="margin: 5px 0;"><strong>Dropoff:</strong> ${
                   endAddress?.line || ""
                 } ${endAddress?.cityName || ""}</p>
               </div>

               <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                 <p style="margin: 5px 0;"><strong>Vehicle:</strong> ${
                   vehicle?.description || "Standard Car"
                 } (${vehicle?.category || ""})</p>
                 <p style="margin: 5px 0;"><strong>Bags:</strong> ${
                   vehicle?.baggages?.[0]?.count || 0
                 } | <strong>Seats:</strong> ${
                   vehicle?.seats?.[0]?.count || 0
                 }</p>
               </div>

               <div style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                 <p style="margin: 5px 0;"><strong>Passengers:</strong> ${
                   car.passengers.length
                 }</p>
                 <p style="margin: 5px 0;"><strong>Note:</strong> ${
                   car.note || "None"
                 }</p>
               </div>
            </div>
          `;
        }
        break;

      case "vacation":
        bookingDetails = `
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #333;">Vacation Details</h3>
              <p style="margin: 5px 0;"><strong>Package:</strong> Vacation Package</p>
            </div>
          `;
        break;
    }

    const emailMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #2c3e50; text-align: center;">Payment Successful</h2>
        <p>Dear ${user?.firstName || "Customer"},</p>
        
        <p>Your payment for <strong>${bookingType}</strong> booking with Order ID <strong>${orderId}</strong> has been successfully processed.</p>
        
        ${bookingDetails}
        
        <p>Thank you for choosing Nesterlify for your travel needs.</p>
        
        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #777;">
          <p>Best regards,<br>The Nesterlify Team</p>
        </div>
      </div>
    `;

    await Promise.all([
      sendMail({
        email: user?.email || "",
        subject: "Payment Successful - Booking Confirmed",
        message: `Your payment for ${bookingType} booking with order ID ${orderId} has been successfully processed.`, // Fallback text
        htmlContent: emailMessage,
      }),
      Notification.create({
        userId: booking.userId,
        title: "Payment Successful",
        message: `Your payment for ${bookingType} booking with order ID ${orderId} has been successfully processed.`,
        category: `${bookingType}` as any,
      }),
    ]);

    logger.info(`Payment success email sent for order ${orderId}`);
  } catch (error) {
    logger.error(
      `Error sending payment success email for order ${orderId}:`,
      error
    );
    // Don't throw error to prevent blocking the main flow, just log it
  }
};
