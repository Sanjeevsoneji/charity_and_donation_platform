// Import necessary modules
import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from "azle";
import { v4 as uuidv4 } from "uuid";

/**
 * Represents the structure of a charity record.
 */
type Charity = Record<{
  id: string;
  name: string;
  member: string;
  location: string;
  fundAvailable: number;
  logoImage: string;
  donors: Vec<Principal>;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

// Define the payload for creating a new Charity record
type CharityPayload = Record<{
  name: string;
  member: string;
  location: string;
  logoImage: string;
}>;

/**
 * Represents the structure of a donation record.
 */
type Donation = Record<{
  id: string;
  charityId: string;
  amount: number;
  donor: Principal;
  createdAt: nat64;
}>;

// Define the payload for making a donation
type DonationPayload = Record<{
  charityId: string;
  amount: number;
}>;

// Create storage for charities and donations
const charityStorage = new StableBTreeMap<string, Charity>(0, 44, 1024);
const donationStorage = new StableBTreeMap<string, Donation>(2, 44, 1024);

// Function to create a new Charity record
$update;
export function createCharity(payload: CharityPayload): Result<Charity, string> {

  // Check if required fields in the payload are missing
  if (!payload.name || !payload.member || !payload.location || !payload.logoImage) {
    return Result.Err<Charity, string>("Missing required fields in the payload");
  }

  // Check if a charity with the same name already exists
  const existingCharity = charityStorage.values().find((charity) => charity.name === payload.name);
  if (existingCharity) {
    return Result.Err<Charity, string>("Charity with the same name already exists");
  }
  try {
    // Create a new charity object
    const charity: Charity = {
      id: uuidv4(),
      createdAt: ic.time(),
      updatedAt: Opt.None,
      fundAvailable: 0,
      donors: [],
      name: payload.name,
      member: payload.member,
      location: payload.location,
      logoImage: payload.logoImage
    };

    try {
      // Insert the new charity record into storage
      charityStorage.insert(charity.id, charity);
      return Result.Ok<Charity, string>(charity);
    } catch (error) {
      return Result.Err<Charity, string>('Failed to insert charity');
    }
  } catch (error) {
    return Result.Err<Charity, string>('error');
  }
}

// Function to get a specific Charity record by ID
$query;
export function getCharity(id: string): Result<Charity, string> {
  // Validate the id parameter
  if (!id) {
    return Result.Err<Charity, string>('Invalid id parameter.');
  }

  // Retrieve the charity from storage
  try {
    return match(charityStorage.get(id), {
      Some: (charity) => Result.Ok<Charity, string>(charity),
      None: () => Result.Err<Charity, string>(`Charity with id=${id} not found.`),
    });
  } catch (error) {
    return Result.Err<Charity, string>(`Error while retrieving charity with id ${id}`);
  }
}

// Function to get all Charity records
$query;
export function getAllCharities(): Result<Vec<Charity>, string> {
  try {
    return Result.Ok(charityStorage.values());
  } catch (error) {
    return Result.Err(`Failed to get all charities: ${error}`);
  }
}

// Function to update a Charity record
$update;
export function updateCharity(
  id: string,
  payload: CharityPayload
): Result<Charity, string> {

  // Validate the id parameter
  if (!id) {
    return Result.Err<Charity, string>('Invalid id!.');
  }

  // Check if required fields in the payload are missing
  if (!payload.name || !payload.member || !payload.location || !payload.logoImage) {
    return Result.Err<Charity, string>("Missing required fields in the payload");
  }

  return match(charityStorage.get(id), {
    Some: (existingCharity) => {
      // Create an updated charity object
      const updatedCharity: Charity = {
        ...existingCharity,
        name: payload.name,
        member: payload.member,
        location: payload.location,
        logoImage: payload.logoImage,
        updatedAt: Opt.Some(ic.time()),
      };

      try {
        // Update the charity record in storage
        charityStorage.insert(updatedCharity.id, updatedCharity);
        return Result.Ok<Charity, string>(updatedCharity);
      } catch (error) {
        return Result.Err<Charity, string>('Failed to insert updatedCharity into charityStorage');
      }
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${id} does not exist and cannot be updated.`),
  });
}

// Function to delete a Charity record by ID
$update;
export function deleteCharity(id: string): Result<Charity, string> {
  return match(charityStorage.get(id), {
    Some: (existingCharity) => {
      // Remove the charity record from storage
      charityStorage.remove(id);
      return Result.Ok<Charity, string>(existingCharity);
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${id} not found.`),
  });
}

// Function to donate to a Charity
$update;
export function donateToCharity(charityId: string, amount: number): Result<Charity, string> {
  if (!charityId || typeof charityId !== 'string') {
    return Result.Err<Charity, string>('Invalid charityId!.');
  }

  if (amount <= 0) {
    return Result.Err<Charity, string>("Donation amount must be greater than zero.");
  }

  return match(charityStorage.get(charityId), {
    Some: (charity) => {
      // Create an updated charity object with the donation details
      const updatedCharity: Charity = {
        ...charity,
        fundAvailable: charity.fundAvailable + amount,
        donors: [...charity.donors, ic.caller()],
      };

      // Update the charity record with the donation
      updateCharity(charity.id, updatedCharity);

      // Create a new donation object
      const donation: Donation = {
        id: uuidv4(),
        charityId: charity.id,
        amount,
        donor: ic.caller(),
        createdAt: ic.time(),
      };

      try {
        // Insert the donation record into storage
        donationStorage.insert(donation.id, donation);
      } catch (error) {
        return Result.Err<Charity, string>('Failed to insert donation into donationStorage');
      }

      return Result.Ok<Charity, string>(updatedCharity);
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${charityId} not found.`),
  });
}

// Set up a random number generator for generating UUIDs
globalThis.crypto = {
  //@ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
