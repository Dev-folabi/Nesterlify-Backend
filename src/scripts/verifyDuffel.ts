import { Duffel } from "@duffel/api";
import dotenv from "dotenv";

dotenv.config();

const { DUFFEL_TOKEN } = process.env;

const duffel = new Duffel({
  token: DUFFEL_TOKEN || "",
  apiVersion: "v2",
});

async function verifyDuffel() {
  console.log("Current NODE_ENV:", process.env.NODE_ENV);
  console.log(
    "Duffel Token starts with:",
    DUFFEL_TOKEN ? DUFFEL_TOKEN.substring(0, 12) : "MISSING"
  );

  try {
    console.log("Attempting hotel search with Duffel...");
    const searchParams = {
      rooms: 1,
      guests: [{ type: "adult" as const }],
      check_in_date: "2025-12-27",
      check_out_date: "2025-12-28",
      location: {
        radius: 1,
        geographic_coordinates: {
          latitude: 40.7127281,
          longitude: -74.0060152,
        },
      },
    };
    console.log("Search Params:", JSON.stringify(searchParams, null, 2));
    const result = await duffel.stays.search(searchParams);
    console.log("✅ Duffel Search Successful!");
    console.log("Number of hotels found:", result.data.results.length);
  } catch (error: any) {
    console.log("❌ Duffel Search Failed!");
    console.log("Error Message:", error.message);
    console.log("Error Stack:", error.stack);
    console.log("Duffel Errors:", JSON.stringify(error.errors, null, 2));
    console.log("Duffel Meta:", JSON.stringify(error.meta, null, 2));
    if (error.headers) {
      console.log("Response Status:", error.headers.status);
    }
  }
}

verifyDuffel();
