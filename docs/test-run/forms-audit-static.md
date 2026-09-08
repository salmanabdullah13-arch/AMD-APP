# Forms pass — the reading half (dropped refusals, pre-answered selects)

Generated 2026-09-07 11:27 by `forms-audit-static.js`.
Two of the five defects Salman found on 5 Sep are findable by reading: a refusal the screen throws away, and a select that opens on a real answer. This lists every other instance.

## A · Refusals thrown away (0)

A data-layer function that can `return {error}`, called from a screen with its result discarded — the guard fires and the person sees nothing happen.

_None._

## B · Selects that open pre-answered (127)

The first `<option>` carries a real value, so whatever happens to be first is what gets saved unless the person notices. A filter defaulting to "All" is fine; a field that becomes a record is not.

| File | Line | id | First option |
|---|---|---|---|
| `accounts.js` | 413 | `ac-lg-tax` | _list, no placeholder_ |
| `accounts.js` | 499 | `ac-` | _list, no placeholder_ |
| `accounts.js` | 620 | `ac-jl-ledger-` | _list, no placeholder_ |
| `accounts.js` | 695 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 755 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 760 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 790 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 816 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 1060 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 1158 | `(no id)` | _list, no placeholder_ |
| `accounts.js` | 1219 | `cu-customer` | _list, no placeholder_ |
| `accounts.js` | 1229 | `cu-salesman` | _list, no placeholder_ |
| `accounts.js` | 1243 | `cu-vat` | _list, no placeholder_ |
| `accounts.js` | 1374 | `(no id)` | _list, no placeholder_ |
| `admin.js` | 218 | `admin-usertype-` | _list, no placeholder_ |
| `admin.js` | 261 | `admin-dl-user` | _list, no placeholder_ |
| `approval-queue.js` | 90 | `aq-usertype-` | _list, no placeholder_ |
| `auth.js` | 188 | `auth-usertype-select` | _list, no placeholder_ |
| `auth.js` | 207 | `auth-identity-select` | _list, no placeholder_ |
| `auth.js` | 414 | `cloud-identity-usertype-select` | _list, no placeholder_ |
| `auth.js` | 419 | `cloud-identity-select` | _list, no placeholder_ |
| `curtain.js` | 1090 | `cs-opening-dir` | _list, no placeholder_ |
| `curtain.js` | 1101 | `cs-bracket-type` | _list, no placeholder_ |
| `curtain.js` | 1112 | `cs-cord-type` | _list, no placeholder_ |
| `curtain.js` | 1125 | `cs-cord-side` | _list, no placeholder_ |
| `curtain.js` | 1861 | `(no id)` | _list, no placeholder_ |
| `curtain.js` | 1872 | `(no id)` | _list, no placeholder_ |
| `curtain.js` | 2015 | `(no id)` | _list, no placeholder_ |
| `curtain.js` | 2026 | `(no id)` | _list, no placeholder_ |
| `curtain.js` | 2298 | `ri-job` | _list, no placeholder_ |
| `curtain.js` | 2302 | `ri-vendor` | _list, no placeholder_ |
| `curtain.js` | 4528 | `qc-rework-stage` | _list, no placeholder_ |
| `curtain.js` | 4949 | `tl-job-select` | _list, no placeholder_ |
| `curtain.js` | 4955 | `tl-window-select` | _list, no placeholder_ |
| `curtain.js` | 4960 | `tl-role-select` | _list, no placeholder_ |
| `estimator.js` | 312 | `(no id)` | _list, no placeholder_ |
| `estimator.js` | 318 | `(no id)` | _list, no placeholder_ |
| `estimator.js` | 570 | `bom-tpl-apply` | _list, no placeholder_ |
| `estimator.js` | 587 | `bom-copy-source` | _list, no placeholder_ |
| `estimator.js` | 729 | `lab-dept` | _list, no placeholder_ |
| `estimator.js` | 731 | `lab-cat` | _list, no placeholder_ |
| `fleet-delivery.js` | 185 | `fleet-insp-pass-` | `<option value="pass">` |
| `hr.js` | 227 | `hr-payhead-select` | _list, no placeholder_ |
| `hr.js` | 240 | `hr-dep-relation` | _list, no placeholder_ |
| `hr.js` | 328 | `(no id)` | _list, no placeholder_ |
| `hr.js` | 331 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 285 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 774 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 841 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 845 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 848 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 904 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 905 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 977 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 980 | `(no id)` | _list, no placeholder_ |
| `jobs.js` | 995 | `prjob-unit` | _list, no placeholder_ |
| `jobs.js` | 1295 | `jt-assignee` | _list, no placeholder_ |
| `operations.js` | 355 | `snag-assign` | _list, no placeholder_ |
| `operations.js` | 396 | `comm-by` | _list, no placeholder_ |
| `operations.js` | 561 | `del-to-` | _list, no placeholder_ |
| `painting.js` | 324 | `(no id)` | _list, no placeholder_ |
| `print.js` | 128 | `(no id)` | _list, no placeholder_ |
| `production-ui.js` | 809 | `(no id)` | _list, no placeholder_ |
| `purchasing.js` | 156 | `(no id)` | _list, no placeholder_ |
| `purchasing.js` | 179 | `(no id)` | _list, no placeholder_ |
| `purchasing.js` | 1500 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 390 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 485 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 501 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 553 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 563 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 567 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 627 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 630 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 648 | `fu-type` | _list, no placeholder_ |
| `sales.js` | 649 | `fu-outcome` | _list, no placeholder_ |
| `sales.js` | 749 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 754 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 1700 | `fin-covering` | _list, no placeholder_ |
| `sales.js` | 1706 | `fin-terms` | _list, no placeholder_ |
| `sales.js` | 1883 | `(no id)` | _list, no placeholder_ |
| `sales.js` | 1893 | `(no id)` | _list, no placeholder_ |
| `store-ui.js` | 505 | `(no id)` | `<option value="good">` |
| `storekeeper.js` | 356 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 360 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 450 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 454 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 458 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 504 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 507 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 513 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 519 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 525 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 705 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 712 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 837 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 843 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 873 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 941 | `(no id)` | _list, no placeholder_ |
| `storekeeper.js` | 946 | `(no id)` | _list, no placeholder_ |
| `teamcomms.js` | 64 | `comms-to` | _list, no placeholder_ |
| `upholstery-ui.js` | 589 | `(no id)` | _list, no placeholder_ |
| `index.html` | 472 | `cs-rail-type` | _list, no placeholder_ |
| `index.html` | 499 | `cs-motorbrand` | _list, no placeholder_ |
| `index.html` | 506 | `cs-motormodel` | _list, no placeholder_ |
| `index.html` | 767 | `po-payment-mode` | _list, no placeholder_ |
| `index.html` | 776 | `po-supplier-select` | _list, no placeholder_ |
| `index.html` | 780 | `po-cash-ledger` | _list, no placeholder_ |
| `index.html` | 838 | `pr-form-division` | _list, no placeholder_ |
| `index.html` | 842 | `pr-form-dept` | _list, no placeholder_ |
| `index.html` | 846 | `pr-form-job` | _list, no placeholder_ |
| `index.html` | 851 | `pr-form-dest` | _list, no placeholder_ |
| `index.html` | 877 | `pod-form-dept` | _list, no placeholder_ |
| `index.html` | 881 | `pod-form-job` | _list, no placeholder_ |
| `index.html` | 885 | `pod-form-dest` | _list, no placeholder_ |
| `index.html` | 893 | `pod-payment-mode` | _list, no placeholder_ |
| `index.html` | 902 | `pod-supplier-select` | _list, no placeholder_ |
| `index.html` | 906 | `pod-cash-ledger` | _list, no placeholder_ |
| `index.html` | 943 | `invd-form-dept` | _list, no placeholder_ |
| `index.html` | 947 | `invd-form-job` | _list, no placeholder_ |
| `index.html` | 951 | `invd-form-dest` | _list, no placeholder_ |
| `index.html` | 959 | `invd-supplier-select` | _list, no placeholder_ |
| `index.html` | 1006 | `sup-tax-percent` | _list, no placeholder_ |
| `index.html` | 1018 | `sup-country` | _list, no placeholder_ |
| `index.html` | 1034 | `pay-supplier-select` | _list, no placeholder_ |
| `index.html` | 1103 | `dn-supplier-select` | _list, no placeholder_ |
| `index.html` | 1108 | `dn-taxable-type` | _list, no placeholder_ |