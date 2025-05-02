# 🌍 Nesterlify Backend

**Nesterlify** is a crypto-powered booking system designed for managing travel services such as flights, car rentals, and vacation packages. It supports seamless cryptocurrency payments via **Binance Pay**, **GatePay**, and **NowPayments**, with integrated real-time notifications through **Brevo**.

---

## 🚀 Features

* **Service Booking Support**: Manage bookings for flights, cars, and vacation packages.
* **Crypto Payments Only**: Integrated with Binance Pay, GatePay, and NowPayments.
* **Brevo Notification Integration**: Real-time email notifications for bookings and payment status.
* **Payment Verification**: Handles crypto payment callbacks and booking updates.
* **MongoDB + Mongoose**: Schema-driven NoSQL data modeling.

---

## 🧱 Tech Stack

| Component      | Technology                        |
| -------------- | --------------------------------- |
| Language       | Node.js, TypeScript               |
| Framework      | Express.js                        |
| Database       | MongoDB with Mongoose             |
| Payments       | Binance Pay, GatePay, NowPayments |
| Notifications  | Brevo (Email API)                 |
| Authentication | JWT (JSON Web Tokens)             |
| Environment    | dotenv                            |
| Deployment     | Docker                            |

---

## 🧭 Booking Flow Overview

1. **User Initiates Booking** for a service (flight, car, vacation).
2. **User Chooses Payment Method** (Binance Pay, GatePay, or NowPayments).
3. **Payment is Initialized** via selected crypto gateway.
4. **Webhook Receives Confirmation** from payment provider.
5. **Booking Status is Updated** and **Brevo** sends confirmation email.

---

## 🔐 Payment Gateway Integration

### Binance Pay

* REST API-based payment initiation
* Handles payment status updates via webhook

### GatePay

* Easy crypto invoice creation and callback handling
* Includes order tracking

### NowPayments

* Supports a wide range of cryptocurrencies
* Webhook support for confirming payment status

---

## 🧪 Testing

* Use tools like **ngrok** to expose local webhook endpoints for testing.
* Simulate crypto payments using sandbox/test modes ( for supported provider).

---

## 🐳 Docker (Optional)

```dockerfile
# Dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t nesterlify-backend .
docker run -p 5000:5000 nesterlify-backend
```


---

## 🤝 Ownership & Licensing

This is a **client-owned project** and is **not open source**. All rights belong to the original client. No license is included.

---

## 👨‍💻 Developer

**Yusuf Afolabi** – Backend Engineer
[GitHub](https://github.com/Dev-folabi)
