import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt, Principal } from "azle";
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

export function createCharity(payload: CharityPayload): Result<Charity, string> {
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

export function getCharity(id: string): Result<Charity, string> {
  const charity = charityStorage.get(id);
  if (charity) {
    return Result.Ok(charity);
  } else {
    return Result.Err(`Charity with id=${id} not found.`);
  }
}

export function getAllCharities(): Result<Vec<Charity>, string> {
  return Result.Ok(charityStorage.values());
}

export function updateCharity(id: string, payload: CharityPayload): Result<Charity, string> {
  const existingCharity = charityStorage.get(id);
  if (existingCharity) {
    const updatedCharity: Charity = {
      ...existingCharity,
      ...payload,
      updatedAt: Opt.Some(ic.time()),
    };

    charityStorage.insert(id, updatedCharity);
    return Result.Ok(updatedCharity);
  } else {
    return Result.Err(`Charity with id=${id} not found.`);
  }
}

export function deleteCharity(id: string): Result<Charity, string> {
  const existingCharity = charityStorage.get(id);
  if (existingCharity) {
    charityStorage.remove(id);
    return Result.Ok(existingCharity);
  } else {
    return Result.Err(`Charity with id=${id} not found.`);
  }
}

export function donateToCharity(payload: DonationPayload): Result<Charity, string> {
  const { charityId, amount } = payload;
  const charity = charityStorage.get(charityId);

  if (charity) {
    charity.fundAvailable += amount;

    const donation: Donation = {
      id: uuidv4(),
      charityId: charity.id,
      amount,
      donor: ic.caller(),
      createdAt: ic.time(),
    };

    charity.donors.push(donation.donor);

    donationStorage.insert(donation.id, donation);

    return Result.Ok(charity);
  } else {
    return Result.Err(`Charity with id=${charityId} not found.`);
  }
}
