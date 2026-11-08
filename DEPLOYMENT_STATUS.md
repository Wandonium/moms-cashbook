# Deployment status — 8 November 2026

Implementation is ready in this dedicated sanitized repository. Automated Node
checks and independent ZIP/XML comparisons of EUR/USD/KES outputs pass.

Publication is blocked in the current execution session:

- `gh api user`: error connecting to api.github.com.
- `curl https://api.github.com`: could not resolve host.
- `gh auth status` reports invalid credentials, but this is inconclusive while
  GitHub is unreachable. Recheck authentication with network access first.
- Local preview cannot bind its port: Operation not permitted. Browser flow and
  native Excel visual verification of this new implementation remain pending.

No GitHub repository, Pages deployment or public URL has been created.

To publish from an unrestricted Terminal with network access:

```sh
cd /Users/mac/Documents/moms-projects/vouchers-browser
zsh publish.command
```

The script checks authentication, creates a private `moms-cashbook` repository
under the authenticated GitHub account, pushes main, configures Pages to use
Actions and starts deployment. If private-repository Pages is unavailable on
that account's plan, it stops without making the repository public. GitHub Pro
or another eligible plan is required. Check the printed workflow's result before
sharing the URL; the initial URL output alone does not verify deployment.

The old local trial remains a separate deployment. Its LaunchAgent was disabled,
while unloading its existing process and removing the Funnel were blocked by
session permissions. Finish that teardown with the existing script in
`../vouchers/Stop Cashbook Trial.command` from the Mac's Terminal.
