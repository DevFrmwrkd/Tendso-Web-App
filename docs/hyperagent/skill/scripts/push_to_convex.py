#!/usr/bin/env python3
"""
push_to_convex.py — POST the validated result to the Convex callback endpoint.

Reads credentials from the environment (injected by Hyperagent credential injection):
  CONVEX_CALLBACK_URL     e.g. https://<deployment>.convex.site/hyperagent-callback
  TENDSO_CALLBACK_SECRET  shared secret, sent as the X-Tendso-Secret header

Usage:
  push_to_convex.py --result work/result.json

Exits 0 on a 2xx response, 1 otherwise.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

HTTP_TIMEOUT = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--result", required=True)
    args = ap.parse_args()

    url = os.environ.get("CONVEX_CALLBACK_URL")
    secret = os.environ.get("TENDSO_CALLBACK_SECRET")
    if not url:
        print("ERROR: CONVEX_CALLBACK_URL is not set.", file=sys.stderr)
        sys.exit(1)
    if not secret:
        print("ERROR: TENDSO_CALLBACK_SECRET is not set.", file=sys.stderr)
        sys.exit(1)

    with open(args.result, "rb") as f:
        body = f.read()

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Tendso-Secret": secret,
            "User-Agent": "tendso-studio/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as r:
            status = r.status
            text = r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        print(f"ERROR: Convex returned {e.code}: {e.read().decode('utf-8', 'replace')}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: request failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"convex {status}: {text}")
    sys.exit(0 if 200 <= status < 300 else 1)


if __name__ == "__main__":
    main()
