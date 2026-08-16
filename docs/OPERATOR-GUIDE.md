# Regrind Log — Operator Guide

**Rapid 600 granulator · AGRU Fernley**

How to log a regrind run on the tablet. Takes about two minutes to read.
Print this and keep it with the station.

---

## What this is

A logbook. You tell it what you ran and it does the math — pounds per hour,
yield, how close the amps got to tripping.

**It does not touch the machine.** It cannot start it, stop it, or change any
setting. Nothing you type here changes how the granulator runs. The VFD is
always 20; the app only shows that so the numbers have context. It is never
something you set here.

---

## 1. Sign in

Tap your name on the "Who's working?" screen.

- **Your name isn't listed?** Reference → Employees → type the name → Add
  employee.
- **It asks for a PIN?** A PIN only stops someone tapping the wrong name by
  accident. It is not a password and it does not protect anything private.
- **Forgot the PIN?** Tap **Can't sign in?** → **Clear PINs on this device**.
  Names and every logged run are kept. Set a new PIN later if you want one.

Your name gets stamped on each run you log, so the shift report shows who ran
what.

---

## 2. Log a roll

This is the whole job. Two taps, one at each end of the run.

### When you start the roll

Go to **Log**.

| Field | What to put |
|---|---|
| Material | Smooth, Micro, MicroDrain, MicroSpike, or Other |
| Start time | Fills in automatically. Change it if you're logging late. |
| Input weight (lb) | What went in. **Required.** |
| Roll ID | Optional — the roll number if you have it |
| Notes | Optional |

Tap **Start Roll**. The timer starts running.

> **Started the roll ten minutes ago?** Set the start time back before you tap
> Start Roll. The duration and lb/hr come from that time, so a wrong start time
> makes every number for that run wrong.

### When the roll finishes

The screen is already waiting on **Finish Roll**.

| Field | What to put |
|---|---|
| End time | Fills in automatically |
| Output / regrind (lb) | What came out. Leave blank if you didn't weigh it. |
| Peak amps | The highest amps you saw |
| Running-out amps | Amps as it cleared out |
| Issue flags | Jam · Thermal trip · Screen change · Knife · Other |
| Notes | Anything worth remembering |

Tap **Finish Roll**. It moves into **This shift** with the math done.

> **Leave a box empty if you didn't measure it.** Blank is honest. A made-up
> number is worse than no number — the app shows `—` and skips it instead of
> pretending it was zero.

### Other ways to add a run

- **Manual entry** — a run that already finished. Type both times yourself.
- **Duplicate last run** — same material and weight again. Copies the last one
  so you only edit what changed.

---

## 3. Reading the numbers

**Pulse** is the at-a-glance screen: shift weight, average lb/hr, average roll
time, rolls done, and how the last run did.

### The amp bar

<img src="screenshots/07-headroom.png" width="640" alt="Amp headroom bar showing peak amps against the safe and trip marks">

Shows the last run's peak amps against your limits.

| Color | Label | Meaning |
|---|---|---|
| 🟩 Green | Safe | Below the safe ceiling |
| 🟧 Amber | Near ceiling | At or past safe, still under trip |
| 🟥 Red | At / over trip | Hit the trip threshold |

The two dashed marks are **safe** and **trip**. Defaults are 130 A and 140 A —
change them in Reference only if the approved SOP says different.

### The other words

- **lb/hr** — pounds per hour. Input weight ÷ how long it took.
- **Yield %** — output ÷ input. Blank if you didn't weigh the output.
- **Headroom** — amps you had left before trip.

**Insights** compares material against material for the shift — which one runs
faster, which one pulls more amps. It never compares VFD settings, because
every run is at 20.

---

## 4. End of shift

**Export a backup. Every shift.**

Reference → **Export JSON backup**.

Everything lives on this tablet only. There is no server and no cloud copy. If
somebody clears the browser data, whatever wasn't exported is gone for good.

Also available in Reference:

- **Export CSV** — opens in Excel
- **Export PDF report** — shift summary to send on
- **Restore from JSON…** — load a backup back in
- **New shift** — clears runs and shift notes, keeps thresholds and material
  notes
- **Clear all data** — wipes everything. Back up first.

To print: open **Reference**, then use the browser's own Print command.

If someone set up a **reports folder**, exports save straight there with no
save dialog.

---

## Problems

**The app won't load / the screen is blank.**
Close it and open it again. It works without internet once it has loaded, so
the plant network being down is not the cause.

**My runs are gone.**
Check you're on the same tablet and the same browser. If the browser data was
cleared, restore the last backup: Reference → Restore from JSON…

**It says the saved data couldn't be read.**
Don't clear anything. Reference offers the old file as a download — save it and
hand it to Jesse.

**I'm not sure this tablet has the latest version.**
Reference shows a build number at the very bottom. After an update, the app
picks it up the *next* time you open it — the first launch after a deploy still
runs the old copy.

**I typed a run wrong.**
Tap the run in **This shift** → edit it. Deleting shows an **Undo**.

---

## The rules

1. Never use this app to decide a machine setting. It is a logbook. The SOP
   and your supervisor decide settings.
2. Leave a field blank if you didn't measure it.
3. Export a backup at the end of every shift.
4. Runs marked **DEMO** are fake sample data. Clear them from Reference → Demo
   data before logging real production.
