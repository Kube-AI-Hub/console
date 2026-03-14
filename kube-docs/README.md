# Kube AI Hub Website

This repository contains branches that we are working on.

The master branch contains Kube AI Hub Doc 3.4 which has been released together with Kube AI Hub 3.4. The frontend website currently displays content based on the master branch. If the pull request you submit applies to both the master branch and other branches, use the command `cherry-pick` to submit the same pull request.

This project uses [Hugo](https://gohugo.io/) to build the Kube AI Hub website.

## Contribute to the project

Contributions of any kind are welcome! Thanks goes to these wonderful contributors, they made our community and product grow fast.

<a href="https://github.com/kubesphere/website/graphs/contributors">
  <img src="https://contributors-img.web.app/image?repo=kubesphere/website" />
</a>

### Fork and clone the repository

1. Fork the repository.

2. Clone the repository to a local path and access it:

   ```
   git clone https://github.com/<username>/website
   cd website
   ```

### Compile and preview the website

You need to build the website to **publish it as static content.**

#### Install Hugo extended

Go to the [Hugo releases place](https://github.com/gohugoio/hugo/releases) and download the `hugo_extended` version that better suits your OS (version 0.70+).

**EXTENDED version is MANDATORY to properly build the static content!**

Note: If you install Hugo on Windows, you need to add environment variables for the .exe file of Hugo. For example, you place the .exe file in the path `C:\Hugo\bin`. You have to add this path in environment variables. Execute `hugo version` to view if the installation is successful.

### Run the website locally

After you have installed Hugo, run the following command:

```
hugo server -D
```

Now you can preview the website in your browser using `http://localhost:1313/`.

### Open a pull request

Open a [pull request (PR)](https://help.github.com/en/desktop/contributing-to-projects/creating-an-issue-or-pull-request#creating-a-new-pull-request) to make contributions to the repository. Please use DCO sign-off when you submit a pull request. Refer to the command below (add `-s`):

```bash
git commit -s -m "xxx"
```

### Preview a pull request

Go to the **Files changed** tab. Click the three dots of the .md file you want to preview, and then click **View file**. Please note that this method can only give you a preview on the GitHub instead of on the website.

![view-file](static/images/common/view-file.png)

### Cherry pick a commit

The command `cherry-pick` allows you to pick a commit in a branch and integrate it into another branch. For example, we are working on both the master branch and the release-3.2 branch. If the pull request you submit to the master branch applies to the release-3.2 branch as well, perform the following steps:

1. In the master branch, find and copy the commit ID of your pull request.

   ```
   git log
   ```

2. Switch to the release-3.2 branch:

   ```
   git checkout release-3.2
   ```

3. Rebase first:

   ```bash
   git pull --rebase upstream release-3.2
   ```

4. Use the branch release-3.2 to switch to a new branch:

   ```bash
   git checkout -b test
   ```

5. Cherry pick the commit:

   ```bash
   git cherry-pick <CommitID>
   ```

6. Push the commit:

   ```bash
   git push -u origin test
   ```

When you submit the pull request, make sure you submit it to the release-3.2 branch.

## Localization

You are welcome to join the Kube AI Hub community to contribute to the localization. Please refer to [Localizing the website](localize-website.md) for instructions.

## Build and publish the website (optional)

### Install dependencies

The website now uses Pagefind for local search functionality. Install dependencies first:

```bash
yarn install
```

### Configure your domain

Edit the file `config\_default\config.toml` and modify the var `baseURL` (at the
first line) to set your own domain. It will be hardcoded in the static
files.

```
baseURL = "https://kubesphere.es"
```

#### Build the static content

Build the site with search index:

```bash
yarn build
```

This will run Hugo and then generate the Pagefind search index.

Alternatively, you can run the steps separately:

```bash
# Step 1: Build Hugo static files
hugo

# Step 2: Generate search index
npx pagefind --source public
```

#### Preview the built site

To preview the complete site with search functionality:

```bash
yarn preview
```

#### Get the generated static content

You will find the previously generated content in the `public` directory, including the search index in `public/pagefind/`.

### Search Migration

The website has migrated from Algolia DocSearch to Pagefind local search. For detailed information about the migration, see [SEARCH_MIGRATION.md](SEARCH_MIGRATION.md).

## Generate PDF Documentation

The documentation can be exported as PDF files. All content from the `content/` directory (including `.adoc` and `.md` files) will be converted and merged into a single document per language.

**Features:**
- Files are processed in Hugo navigation order (sorted by frontmatter `weight`)
- The merged PDF includes a clickable Table of Contents (bookmarks)
- Supports resume after interruption (skips already processed files)

### Prerequisites

1. Install asciidoctor-pdf (requires Ruby) for AsciiDoc files:

```bash
gem install asciidoctor-pdf
```

2. Install pandoc and weasyprint for Markdown files（推荐使用 miniforge/conda 环境）:

```bash
# 在 miniforge/conda 环境中
conda install -c conda-forge pandoc weasyprint

# 若需系统库（macOS）
# brew install pango cairo gdk-pixbuf glib gobject-introspection
# export DYLD_FALLBACK_LIBRARY_PATH="/opt/homebrew/lib:${DYLD_FALLBACK_LIBRARY_PATH}"
```

3. Install ghostscript for PDF merging with bookmarks:

```bash
# macOS
brew install ghostscript

# Ubuntu/Debian
sudo apt-get install ghostscript

# CentOS/RHEL
sudo yum install ghostscript
```

4. (Optional) Install pdfinfo for accurate page counting:

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils
```

Notes:
- AsciiDoc PDF generation sets `imagesdir=static/images` to resolve repo-hosted images.
- PDF files are sorted by Hugo `weight` to match website navigation order.

### Generate PDFs

Generate PDF documentation for all languages:

```bash
yarn pdf:build
```

Generate PDF for a specific language:

```bash
# Chinese documentation
yarn pdf:build:zh

# English documentation
yarn pdf:build:en
```

### Clean PDF output

Remove all generated PDF files:

```bash
yarn pdf:clean
```

### PDF output location

Generated PDF files will be saved to the `dist/pdf/` directory:

- `dist/pdf/zh/` - Individual Chinese PDF files
- `dist/pdf/en/` - Individual English PDF files
- `dist/pdf/kube-ai-hub-docs-zh.pdf` - Merged Chinese documentation
- `dist/pdf/kube-ai-hub-docs-en.pdf` - Merged English documentation

### Included content

The following directories are included in PDF generation:

| Directory | Type | Description |
|-----------|------|-------------|
| `docs/_custom/` | .adoc | Custom documentation components |
| `docs/v3.4/` | .md | v3.4 version documentation |
| `common/` | .md | Common requirements |
| `api/` | .md | API documentation (English only) |

**Excluded content:**
- `_ks_components/` and `_ks_components-en/` - Reusable component libraries (for include only)
- `_index.md` files - Hugo directory index pages
