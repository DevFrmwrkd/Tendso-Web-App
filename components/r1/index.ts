/**
 * Round 1 shared components (board: ComponentKit). The styles are the `t-`
 * classes in app/round1.css; these components put them together with the
 * behaviour and accessibility each one needs.
 *
 * Rules of thumb from the kit:
 *  - One primary (black) button per view; the rest go in <MoreMenu>.
 *  - A status is <Status {...submissionStatus(s)} />: a dot plus a word.
 *  - Details open in a <Drawer>, never a new page. A decision is a <Dialog>;
 *    a delete is a <ConfirmDialog>.
 *  - Lists cap at 3–5 rows with <ShowAllList>; tables only on list pages.
 *  - One number and one status per card; one <Highlight> per screen at most.
 *  - Loading is a <Loading> skeleton of the same shape; failure is <ErrorState>.
 */
export { Avatar, initialsOf } from "./Avatar";
export { Button, ButtonLink, buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
export { Card, DefList, DefRow, Highlight, MoneyLine, MoneyLines, NextStepCard, SiteCard, StatCard, Timeline } from "./Card";
export { cx } from "./cx";
export { ErrorState } from "./ErrorState";
export { Checkbox, Field, Input, PasswordInput, PhoneInput, RadioCards, SearchInput, Select, Textarea, type RadioCardOption } from "./Field";
export { Fold, Folds } from "./Fold";
export { Icon } from "./Icon";
export { EmptyState, List, Row, RowButton, RowChevron, RowLink, RowMain, ShowAllList, TableHead } from "./List";
export { Logo } from "./Logo";
export { MoreMenu, type MenuItem } from "./Menu";
export { formatMoney } from "./money";
export { ConfirmDialog, Dialog, Drawer } from "./Overlay";
export { FunnelHeader, PublicFooter, PublicHeader, PublicPage, type FooterLink, type PublicSection } from "./Public";
export { AppShell, NavItem, PageHeader, Sidebar, TabBar, type NavBadge, type NavEntry, type NavLinkEntry, type SidebarProps } from "./Shell";
export { Loading, Skeleton, SkeletonCard, SkeletonRows, SkeletonText, useDelayed } from "./Skeleton";
export { Dot, Status } from "./Status";
export {
    bookingStatus,
    creatorStatus,
    domainStatus,
    leadStatus,
    submissionStatus,
    withdrawalStatus,
    type StatusWord,
    type Tone,
    type Viewer,
} from "./statusWords";
export { Stepper } from "./Stepper";
export { Chips, LinkSegmented, LinkTabs, Segmented, Tabs, type ChipItem, type TabItem } from "./Tabs";
export { Toaster } from "./Toaster";
