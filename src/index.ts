import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
  Principal,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type Donor = Record<{
  id: string;
  name: string;
  email: string;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

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

type CharityPayload = Record<{
  name: string;
  member: string;
  location: string;
  logoImage: string;
}>;

const charityStorage = new StableBTreeMap<string, Charity>(0, 44, 1024);

type Donation = Record<{
  id: string;
  charityId: string;
  amount: number;
  donor: Principal;
  createdAt: nat64;
}>;

type DonationPayload = Record<{
  charityId: string;
  amount: number;
}>;

const donationStorage = new StableBTreeMap<string, Donation>(2, 44, 1024);

// Function to validate email addresses
function isValidEmail(email: string): boolean {
  // Implement your email validation logic here
  // Return true if the email is valid, otherwise false
  return /* Your validation logic */;
}

$update;
export function createCharity(payload: CharityPayload): Result<Charity, string> {
  if (!isValidEmail(payload.email)) {
    return Result.Err<Charity, string>("Invalid email format.");
  }

  const charity: Charity = {
    id: uuidv4(),
    createdAt: ic.time(),
    updatedAt: Opt.None,
    fundAvailable: 0,
    donors: [],
    ...payload,
  };

  charityStorage.insert(charity.id, charity);
  return Result.Ok<Charity, string>(charity);
}

$query;
export function getCharity(id: string): Result<Charity, string> {
  return match(charityStorage.get(id), {
    Some: (charity) => Result.Ok<Charity, string>(charity),
    None: () => Result.Err<Charity, string>(`Charity with id=${id} not found.`),
  });
}

$query;
export function getAllCharities(): Result<Vec<Charity>, string> {
  return Result.Ok(charityStorage.values());
}

$update;
export function updateCharity(
  id: string,
  payload: CharityPayload
): Result<Charity, string> {
  return match(charityStorage.get(id), {
    Some: (existingCharity) => {
      const updatedCharity: Charity = {
        ...existingCharity,
        ...payload,
        updatedAt: Opt.Some(ic.time()),
      };

      charityStorage.insert(updatedCharity.id, updatedCharity);
      return Result.Ok<Charity, string>(updatedCharity);
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${id} not found.`),
  });
}

$update;
export function deleteCharity(id: string): Result<Charity, string> {
  return match(charityStorage.get(id), {
    Some: (existingCharity) => {
      charityStorage.remove(id);
      return Result.Ok<Charity, string>(existingCharity);
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${id} not found.`),
  });
}

$update;
export function donateToCharity(payload: DonationPayload): Result<Charity, string> {
  const { charityId, amount } = payload;

  return match(charityStorage.get(charityId), {
    Some: (charity) => {
      charity.fundAvailable += amount;
      updateCharity(charity.id, charity);

      const donation: Donation = {
        id: uuidv4(),
        charityId: charity.id,
        amount,
        donor: ic.caller(),
        createdAt: ic.time(),
      };

      // Update the donors field of the charity
      charity.donors.push(donation.donor);

      donationStorage.insert(donation.id, donation);

      return Result.Ok<Charity, string>(charity);
    },
    None: () => Result.Err<Charity, string>(`Charity with id=${charityId} not found.`),
  });
}

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
