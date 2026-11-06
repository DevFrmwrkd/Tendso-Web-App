'use client';

/** Local presentation only. No Convex client, account lookup, booking action or transport. */
import { useState } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import BookingShell from '../_components/BookingShell';
import { Button, ConfirmDialog, Field, Icon, Input, Status, bookingStatus } from '../_components/BookingUI';
import { CallFacts, CallTicket, Notice, PickedTime } from '../_components/CallCard';
import SlotPicker, { type Day, type Slot } from '../_components/SlotPicker';
import { formatDay, formatTime } from '../_components/callTime';

type State = 'calendar' | 'details' | 'confirmation' | 'reschedule' | 'cancelled' | 'cancel-dialog';
const START = Date.UTC(2026, 10, 12, 2);
const states: { id: State; label: string }[] = [
    { id: 'calendar', label: 'Calendar' }, { id: 'details', label: 'Details' },
    { id: 'confirmation', label: 'Confirmation' }, { id: 'reschedule', label: 'Reschedule' },
    { id: 'cancelled', label: 'Cancelled' }, { id: 'cancel-dialog', label: 'Cancel popup' },
];
const days: Day[] = [0, 1, 4, 5, 6, 7, 8, 11, 12, 13].map((offset) => {
    const start = START + offset * 86_400_000;
    const dateKey = new Date(start).toISOString().slice(0, 10);
    return { dateKey, label: formatDay(start), slots: [0, 1, 2, 3, 4, 5, 6, 7, 40, 41, 42, 43].map((quarter) => ({
        startMs: start + quarter * 900_000, label: formatTime(start + quarter * 900_000), taken: quarter === 1 || quarter === 5,
    })) };
});

export function BookingDesignPreview() {
    const [state, setState] = useState<State>('calendar');
    const [activeDay, setActiveDay] = useState(days[0].dateKey);
    const [picked, setPicked] = useState<Slot | null>(days[0].slots[2]);
    const [name, setName] = useState('Alex Rivera');
    const [email, setEmail] = useState('alex@example.com');
    const [notice, setNotice] = useState('');
    const when = picked?.startMs ?? START;
    const setPreview = (next: State) => { setState(next); setNotice(''); };
    const chosenDay = days.find(day => day.dateKey === activeDay)?.label;
    const choose = <SlotPicker days={days} activeDay={activeDay} onSelectDay={key => { setActiveDay(key); setPicked(null); }} selected={picked?.startMs ?? null} onSelect={setPicked} mine={state === 'reschedule' ? START : null} />;
    const ticket = <CallTicket status={bookingStatus({ status: 'confirmed', startMs: when })} time={formatTime(when)} day={formatDay(when)} meetUrl={null} name={name} email={email}>
        <div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => setNotice('Preview only. No calendar was opened.')}><Icon icon={Calendar} />Add to calendar</Button><Button onClick={() => setPreview('reschedule')}>Reschedule</Button><Button variant="danger" onClick={() => setPreview('cancel-dialog')}>Cancel this call</Button></div>
        <p className="bk-meta">The actual confirmation email contains your private links to reschedule or cancel.</p>
    </CallTicket>;
    const title = state === 'confirmation' ? 'You’re booked' : state === 'reschedule' ? 'Pick a new time' : state === 'cancelled' ? 'Your call is cancelled' : state === 'cancel-dialog' ? 'Your 10-minute call' : 'Book your 10-minute call';
    const current = state === 'details' || state === 'reschedule' ? 1 : state === 'confirmation' || state === 'cancelled' ? 3 : 0;
    return <BookingShell title={title} steps={state === 'reschedule' || state === 'cancel-dialog' || state === 'cancelled' ? ['Your call', 'New time', 'Done'] : ['Time', 'Details', 'Done']} current={current}>
        <div className="bk-preview-banner"><strong>Design preview only · No appointment created</strong><p>Fictional details. All controls stay on this page; no booking is sent, moved or cancelled.</p>
            <div className="bk-preview-tabs" role="group" aria-label="Preview booking state">{states.map(item => <button key={item.id} type="button" aria-pressed={state === item.id} onClick={() => setPreview(item.id)}>{item.label}</button>)}</div>
        </div>
        {notice ? <Notice>{notice}</Notice> : null}
        {state === 'calendar' || state === 'reschedule' ? <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-12">
            {choose}<aside className="bk-card flex flex-col gap-5 p-5 sm:p-6"><h2 className="bk-h2">{state === 'reschedule' ? 'Moving your call' : 'Your call'}</h2><p className="bk-body">A short video call to get you started as a Tendso field agent.</p><CallFacts /><hr className="bk-divider" /><PickedTime label={state === 'reschedule' ? 'New time' : 'Your time'} time={picked?.label} day={chosenDay} />
                <Button variant="primary" disabled={!picked} onClick={() => setPreview(state === 'reschedule' ? 'confirmation' : 'details')}>{state === 'reschedule' ? 'Preview moved call' : 'Continue'}</Button></aside>
        </div> : null}
        {state === 'details' ? <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-12">
            <form className="bk-card" onSubmit={event => { event.preventDefault(); setPreview('confirmation'); }}><div className="flex flex-col gap-1 border-b bk-border p-5 sm:p-6"><h2 className="bk-h2">Who is joining?</h2><p className="bk-meta">We use this to send you the invite. Nothing else.</p></div>
                <div className="grid gap-5 p-5 sm:grid-cols-2 sm:gap-x-4 sm:p-6"><Field label="Full name" required><Input value={name} onChange={event => setName(event.target.value)} /></Field><Field label="Email" required help="We email your Google Meet link here, with links to reschedule or cancel."><Input type="email" value={email} onChange={event => setEmail(event.target.value)} /></Field></div>
                <div className="flex flex-col-reverse gap-3 border-t bk-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><Button onClick={() => setPreview('calendar')}><Icon icon={ArrowLeft} />Change time</Button><Button type="submit" variant="primary" size="lg">Preview confirmation</Button></div>
            </form><aside className="bk-card flex flex-col gap-5 p-5 max-lg:order-first sm:p-6"><h2 className="bk-h2">Your call</h2><PickedTime label="Your time" time={formatTime(when)} day={formatDay(when)} /><hr className="bk-divider" /><CallFacts /></aside>
        </div> : null}
        {state === 'confirmation' || state === 'cancel-dialog' ? <div className="mx-auto w-full max-w-[560px]">{ticket}</div> : null}
        {state === 'cancelled' ? <article className="bk-card mx-auto flex w-full max-w-[560px] flex-col gap-4 px-6 py-8"><Status {...bookingStatus({ status: 'cancelled' })} /><h2 className="bk-h2 bk-num line-through">{formatDay(when)} · {formatTime(when)}</h2><p className="bk-body">That time is open again, and we emailed you a confirmation. Your Meet link no longer works.</p><Button variant="primary" onClick={() => setPreview('calendar')}>Book another time</Button></article> : null}
        <ConfirmDialog open={state === 'cancel-dialog'} onCancel={() => setPreview('confirmation')} onConfirm={() => setPreview('cancelled')} title="Cancel this call?" confirmLabel="Yes, cancel it"><p>{formatDay(when)} at {formatTime(when)}. The time goes back on offer and your Google Meet link stops working.</p></ConfirmDialog>
    </BookingShell>;
}
