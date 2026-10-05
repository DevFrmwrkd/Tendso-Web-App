import { initialsOf } from "@/components/r1/Avatar";
import { formatMoney } from "@/components/r1/money";
import {
    bookingStatus,
    creatorStatus,
    domainStatus,
    leadStatus,
    submissionStatus,
    withdrawalStatus,
} from "@/components/r1/statusWords";

describe("submissionStatus", () => {
    it("says the same submission needs the admin and is in review for the creator", () => {
        expect(submissionStatus("submitted", "admin")).toEqual({ tone: "attn", word: "Needs review" });
        expect(submissionStatus("in_review", "creator")).toEqual({ tone: "progress", word: "In review" });
    });

    it("maps every documented backend value to a kit word", () => {
        expect(submissionStatus("draft").word).toBe("Draft");
        expect(submissionStatus("website_generated").word).toBe("Site generated");
        expect(submissionStatus("approved").word).toBe("Site generated");
        expect(submissionStatus("deployed")).toEqual({ tone: "progress", word: "Live — awaiting payment" });
        expect(submissionStatus("pending_payment").word).toBe("Live — awaiting payment");
        expect(submissionStatus("paid")).toEqual({ tone: "done", word: "Paid" });
        expect(submissionStatus("completed").word).toBe("Paid");
        expect(submissionStatus("rejected")).toEqual({ tone: "bad", word: "Rejected" });
        expect(submissionStatus("unpublished")).toEqual({ tone: "off", word: "Unpublished" });
    });

    it("never shows a blank word for a value it does not know", () => {
        expect(submissionStatus("some_new_state")).toEqual({ tone: "off", word: "Some new state" });
        expect(submissionStatus(undefined).word).toBe("Unknown");
    });
});

describe("other status words", () => {
    it("withdrawals", () => {
        expect(withdrawalStatus("pending").word).toBe("Processing");
        expect(withdrawalStatus("processing").word).toBe("Processing");
        expect(withdrawalStatus("completed")).toEqual({ tone: "done", word: "Paid out" });
        expect(withdrawalStatus("failed")).toEqual({ tone: "bad", word: "Failed" });
    });

    it("creators, from the approval timestamps", () => {
        expect(creatorStatus({})).toEqual({ tone: "off", word: "In training" });
        expect(creatorStatus({ quizPassedAt: 1 })).toEqual({ tone: "attn", word: "Waiting for approval" });
        expect(creatorStatus({ quizPassedAt: 1 }, "creator").tone).toBe("progress");
        expect(creatorStatus({ quizPassedAt: 1, certifiedAt: 2 })).toEqual({ tone: "done", word: "Certified" });
        expect(creatorStatus({ quizPassedAt: 1, rejectedAt: 2 })).toEqual({ tone: "bad", word: "Rejected" });
    });

    it("leads", () => {
        expect(leadStatus("new").tone).toBe("attn");
        expect(leadStatus("qualified").word).toBe("Qualified");
        expect(leadStatus("lost").tone).toBe("off");
    });

    it("call bookings use attendance first, then whether the call is still ahead", () => {
        const now = 1_000;
        expect(bookingStatus({ status: "confirmed", startMs: 2_000 }, now).word).toBe("Booked");
        expect(bookingStatus({ status: "confirmed", startMs: 500 }, now)).toEqual({ tone: "attn", word: "Not answered yet" });
        expect(bookingStatus({ status: "confirmed", startMs: 500, attendance: "attended" }, now).word).toBe("Came");
        expect(bookingStatus({ status: "confirmed", startMs: 500, attendance: "no_show" }, now).word).toBe("No-show");
        expect(bookingStatus({ status: "cancelled", startMs: 2_000 }, now).word).toBe("Cancelled");
    });

    it("custom domains", () => {
        expect(domainStatus("configuring_dns").word).toBe("Setting up");
        expect(domainStatus("live").tone).toBe("done");
    });
});

describe("formatMoney", () => {
    it("writes pesos with no space and comma thousands", () => {
        expect(formatMoney(999)).toBe("₱999");
        expect(formatMoney(4999)).toBe("₱4,999");
    });

    it("shows centavos only when they exist", () => {
        expect(formatMoney(1499.5)).toBe("₱1,499.50");
        expect(formatMoney(1499)).toBe("₱1,499");
    });

    it("uses a true minus on debits and + only on credits", () => {
        expect(formatMoney(500, "debit")).toBe("−₱500");
        expect(formatMoney(500, "credit")).toBe("+₱500");
        expect(formatMoney(-500, "auto")).toBe("−₱500");
        expect(formatMoney(-500)).toBe("−₱500");
        expect(formatMoney(0, "credit")).toBe("₱0");
    });
});

describe("initialsOf", () => {
    it("takes the first and last word", () => {
        expect(initialsOf("Jefferson Kam")).toBe("JK");
        expect(initialsOf("Mikee Joy Cumal")).toBe("MC");
        expect(initialsOf("Angel S.")).toBe("AS");
        expect(initialsOf("Theo")).toBe("T");
        expect(initialsOf("")).toBe("?");
    });
});
