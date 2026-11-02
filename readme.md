# SchoolERP
:school:

SchoolERP provides a suite of software covering all parts of a schools' administration, managing registration and admissions, from behaviour and achievement [As part of CCE in Examination module], managing Library, Fee, Accounts, Front - Office, Inventory, Time Table, Infirmary, Hostel & Mess, HR & Payroll and Transport .

Complete application is created in such a manner that at almost all possible places, you may play with records in your style, you may create master records as per your need.

Application is ready to be integrated with any third party device, viz. Biometric Attendance Machine, Barcode Scanner etc.


## Installation 
* Installing SchoolERP is a very easy process.
* Download the latest zip from above and extract to your web-root/ subfolder   
or clone from https://github.com/akshat4112/SchoolERP 
* Create a database for your SchoolERP with name school_erp.
* Access your SchoolERP by accessing proper url like http://localhost/SchoolERP.

## Requirements
:point_right: PHP 5.3 +

:point_right: Mysql 5.0 +

:point_right: PDO Extension in PHP

:point_right: Web Browser FF17.0+, IE8+, Opera, Chrome .... TODO testing


## TypeScript Migration (In Progress)
The TypeScript app currently includes sign-in, session handling, the admission register, enquiry entry/register/daily summary, fee-head and fee-plan setup, daily attendance entry and summaries, a navigable calendar, and administration master data for classes, sections, castes, categories, houses, families, and fee groups/categories. Other ERP modules still run in the original PHP application.

To run the TypeScript app locally:

1. Install Node.js 22.18 or newer and MySQL.
2. From the project root, run `npm install`.
3. Copy `.env.example` to `.env` and set `SESSION_SECRET` and your MySQL connection values.
4. Import `school_erp.sql` into the configured `school_erp` database if it has not already been imported.
5. Apply `migrations/001_create_enquiry_table.sql` to that database.
6. Run `npm run dev` and open `http://127.0.0.1:3000`.

The original PHP application remains available through the existing PHP setup while the TypeScript migration is underway.

## Resources
* Documentation
* Community
* Bug Tracker
# ERP
# asmo
# asmo
