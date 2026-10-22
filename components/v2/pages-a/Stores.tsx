import { APP_LINKS } from "./data";

const APPLE =
    "M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.4-3.66ZM14.1 5.86c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.67-1.1 1.76-.96 2.8 1.01.08 2.05-.52 2.68-1.28Z";

/** The two black store buttons. Links come from env until the apps are listed (see data.ts). */
export function Stores({ id }: { id?: string }) {
    return (
        <div className="stores-row" id={id}>
            <a className="store" href={APP_LINKS.appStore}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d={APPLE} />
                </svg>
                <span>
                    <small>Download on the</small>
                    <b>App Store</b>
                </span>
            </a>
            <a className="store" href={APP_LINKS.googlePlay}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.6 2.3 13.4 11 4.6 19.7c-.36-.2-.6-.6-.6-1.07V3.37c0-.47.24-.87.6-1.07Z" />
                    <path d="m14.5 12.1 2.5 2.5-10.6 6.1 8.1-8.6Z" opacity=".8" />
                    <path d="m14.5 9.9-8.1-8.6L17 7.4l-2.5 2.5Z" opacity=".8" />
                    <path d="m18.3 8.2 2.6 1.5c.85.5.85 1.7 0 2.2l-2.6 1.5-2.7-2.7 2.7-2.5Z" opacity=".6" />
                </svg>
                <span>
                    <small>Get it on</small>
                    <b>Google Play</b>
                </span>
            </a>
        </div>
    );
}
