# Max (Marketing): thank-you and review emails

Every evening at 6:00 PM (Alberta), Max finds the residential jobs completed that
day in ServiceMonster and sends each customer a thank-you email asking for a
5-star Google review.

- `reviews.mjs` reads ServiceMonster only and writes `max/reviews.json`: who to
  thank, and who was skipped and why (Jayman/builders, commercial accounts in
  ServiceMonster or on Penny's commercial list, company names, "Do not email",
  no email address, asked already in the past year, a second job the same day).
- `EMAIL.md` is the email (subject, plain text and HTML). Sent from
  keith@homeprosgroup.com.
- What was sent is logged in the arcade's database, `eddie/reviews`
  (`{sent: [{accountID, wo, name, date}]}`), so nobody is asked twice in a year.
  Email addresses are not stored there.

ServiceMonster also has a "Request for Review" email template, but it has no
review link in it, and ServiceMonster's API has no documented way to send it.
