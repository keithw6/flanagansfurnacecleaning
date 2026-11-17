# Rosa's appointment reminder email

Subject: Reminder: your Home Pros Group appointment tomorrow at {TIME}

Fill in {FIRST} (first name), {DAY} (e.g. Wednesday, November 18), {TIME} (e.g. 11:00 AM)
and {ADDRESS} from reminders.json. If there is no address, leave out the "at {ADDRESS}"
part. Send both versions (plain text as `body`, HTML as `htmlBody`).

## Plain text

Hi {FIRST},

This is a friendly reminder that Home Pros Group is booked to see you tomorrow, {DAY}, at {TIME}, at {ADDRESS}.

To help us get started right away:
- Please make sure we can get to the furnace, and that the vents and cold-air returns aren't covered by furniture or rugs.
- Please keep pets in a separate room while we work.

Need to change the time? Just reply to this email or call us at 780-932-7337.

See you tomorrow,
Keith Wick
Home Pros Group
780-932-7337 | homeprosgroup.com

## HTML

<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222;max-width:560px">
<p>Hi {FIRST},</p>
<p>This is a friendly reminder that Home Pros Group is booked to see you <b>tomorrow, {DAY}, at {TIME}</b>, at {ADDRESS}.</p>
<p>To help us get started right away:</p>
<ul>
<li>Please make sure we can get to the furnace, and that the vents and cold-air returns aren't covered by furniture or rugs.</li>
<li>Please keep pets in a separate room while we work.</li>
</ul>
<p>Need to change the time? Just reply to this email or call us at <a href="tel:7809327337" style="color:#2e8b2a">780-932-7337</a>.</p>
<p>See you tomorrow,<br><b>Keith Wick</b><br>Home Pros Group<br>780-932-7337 | <a href="https://homeprosgroup.com" style="color:#2e8b2a">homeprosgroup.com</a></p>
</div>
