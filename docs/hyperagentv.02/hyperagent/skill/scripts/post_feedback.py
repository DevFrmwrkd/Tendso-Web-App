#!/usr/bin/env python3
"""
post_feedback.py - post a fixed-format skill-feedback card to Slack.

Reads SLACK_WEBHOOK_URL from the environment (injected by Hyperagent). If it's not
set, the card is printed to stdout instead (so it's still captured in the thread)
and the script exits 0.

Usage:
  post_feedback.py --submission <id> --topic "<short>" \
      --did "<what you did>" --ask "<open question>" --proposal "<concrete change>"
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

HTTP_TIMEOUT = 20


def card_text(a):
    return (
        f"*Tendso Studio - skill feedback*\n"
        f"- *Submission:* {a.submission}\n"
        f"- *Topic:* {a.topic}\n"
        f"- *What I did:* {a.did}\n"
        f"- *Question:* {a.ask}\n"
        f"- *Proposed change:* {a.proposal}\n"
        f"_Reply with the call; I'll save it as a memory + add it to Studio Recipes._"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--submission", required=True)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--did", required=True)
    ap.add_argument("--ask", required=True)
    ap.add_argument("--proposal", required=True)
    args = ap.parse_args()

    text = card_text(args)
    webhook = os.environ.get("SLACK_WEBHOOK_URL")

    if not webhook:
        print("SLACK_WEBHOOK_URL not set - printing card instead:\n")
        print(text)
        sys.exit(0)

    body = json.dumps({"text": text}).encode("utf-8")
    req = urllib.request.Request(
        webhook,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "tendso-studio/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
            status = r.status
    except urllib.error.HTTPError as e:
        print(f"ERROR: Slack returned {e.code}: {e.read().decode('utf-8', 'replace')}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Slack request failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"slack {status}: posted feedback card for {args.submission}")


if __name__ == "__main__":
    main()
