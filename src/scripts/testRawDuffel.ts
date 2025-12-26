import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const { DUFFEL_TOKEN } = process.env;

async function testRawDuffel() {
  console.log("Current NODE_ENV:", process.env.NODE_ENV);

  const searchParams = {
    data: {
      rooms: 1,
      guests: [{ type: "adult" }],
      check_in_date: "2025-12-27",
      check_out_date: "2025-12-28",
      location: {
        radius: 5,
        geographic_coordinates: {
          latitude: 40.7127281,
          longitude: -74.0060152,
        },
      },
    },
  };

  try {
    console.log("Sending raw request to Duffel...");
    const response = await axios.post(
      "https://api.duffel.com/stays/search",
      searchParams,
      {
        headers: {
          "Duffel-Version": "v2",
          Authorization: `Bearer ${DUFFEL_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("✅ Raw Request Successful!");
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log("❌ Raw Request Failed!");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Headers:", JSON.stringify(error.response.headers, null, 2));
      console.log("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.log("Error Message:", error.message);
    }
  }
}

testRawDuffel();
