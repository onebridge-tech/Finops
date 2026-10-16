import { describe, expect, it } from "vitest";
import { nameScore, nameTokens, suggestParty } from "./match-party";

const parties = [
  { id: "1", name: "Ravi Tea Traders" },
  { id: "2", name: "Lakshmi General Stores" },
  { id: "3", name: "Ganesh Kirana" },
];

describe("nameTokens", () => {
  it("drops filler words, numbers and UPI handles", () => {
    expect(nameTokens("UPI-RAVI KIRANA STORE-ravi@okaxis-412345678911")).toEqual(["ravi", "kirana"]);
  });
});

describe("suggestParty", () => {
  it("finds a customer from the name on the line", () => {
    expect(suggestParty("RAVI TEA", parties)?.id).toBe("1");
    expect(suggestParty("Lakshmi Stores", parties)?.id).toBe("2");
  });
  it("gives nothing when no name is a clear match", () => {
    expect(suggestParty("Anil Provision Mart", parties)).toBeNull();
    expect(suggestParty(null, parties)).toBeNull();
  });
  it("gives nothing when two customers match equally", () => {
    expect(suggestParty("Ravi", [...parties, { id: "9", name: "Ravi Kumar" }])).toBeNull();
  });
  it("scores whole and partial matches", () => {
    expect(nameScore("Ganesh Kirana Ameerpet", "Ganesh Kirana")).toBe(1);
    expect(nameScore("Ganesh", "Suresh")).toBe(0);
  });
});
