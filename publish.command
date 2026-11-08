#!/bin/zsh
# Publish only this sanitized app. Run in the Mac's Terminal with network access.
set -eu
cd "$(dirname "$0")"
npm test
gh auth status
owner="$(gh api user --jq .login)"
repo="$owner/moms-cashbook"
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$repo" --private --source=. --remote=origin --push
else
  git push -u origin main
fi
visibility="$(gh api "repos/$repo" --jq .visibility)"
if [[ "$visibility" != private ]]; then
  print 'Repository must be private; stopping.'
  exit 1
fi
# A paid GitHub plan is required for Pages on a private personal repository.
if ! gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method POST "repos/$repo/pages" -f build_type=workflow >/dev/null
else
  gh api --method PUT "repos/$repo/pages" -f build_type=workflow >/dev/null
fi
gh workflow run pages.yml --repo "$repo" --ref main
print "Deployment started. Watch with: gh run list --repo $repo --workflow pages.yml"
gh api "repos/$repo/pages" --jq .html_url
