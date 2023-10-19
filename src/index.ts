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

$update;
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

$query;
export function getDonationsForCharity(charityId: string): Result<Vec<Donation>, string> {
  const donations = donationStorage.values().filter((donation) => donation.charityId === charityId);
  return Result.Ok(donations);
}

$query;
export function getCharityFunds(charityId: string): Result<number, string> {
  return match(charityStorage.get(charityId), {
    Some: (charity) => Result.Ok(charity.fundAvailable),
    None: () => Result.Err(`Charity with id=${charityId} not found.`),
  });
}

$query;
export function hasDonatedToCharity(charityId: string): Result<boolean, string> {
  const caller = ic.caller();
  return match(charityStorage.get(charityId), {
    Some: (charity) => Result.Ok(charity.donors.includes(caller)),
    None: () => Result.Err(`Charity with id=${charityId} not found.`),
  });
}

$update;
export function updateCharityLogo(charityId: string, newLogoImage: string): Result<Charity, string> {
  return match(charityStorage.get(charityId), {
    Some: (charity) => {
      charity.logoImage = newLogoImage;
      charity.updatedAt = Opt.Some(ic.time());
      charityStorage.insert(charityId, charity);
      return Result.Ok(charity);
    },
    None: () => Result.Err(`Charity with id=${charityId} not found.`),
  });
}

$query;
export function getCharityDonors(charityId: string): Result<Vec<Principal>, string> {
  return match(charityStorage.get(charityId), {
    Some: (charity) => Result.Ok(charity.donors),
    None: () => Result.Err(`Charity with id=${charityId} not found.`),
  });
}

$query;
export function getLastCharityUpdateTimestamp(charityId: string): Result<nat64, string> {
  return match(charityStorage.get(charityId), {
    Some: (charity) => Result.Ok(charity.updatedAt.getOrElse(nat64(0))),
    None: () => Result.Err(`Charity with id=${charityId} not found.`),
  });
}

$query;
export function getTotalCharitiesCount(): Result<number, string> {
  return Result.Ok(charityStorage.size());
}

$query;
export function getCharitiesByLocation(location: string): Result<Vec<Charity>, string> {
  const charities = charityStorage.values().filter((charity) => charity.location === location);
  return Result.Ok(charities);
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
