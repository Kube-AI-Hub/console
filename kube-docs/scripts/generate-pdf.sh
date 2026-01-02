#!/bin/bash
# PDF Generation Script with Parallel Processing and Fail-Fast
# Usage: generate-pdf.sh <lang>
#   lang: zh or en

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -ne 1 ]; then
    echo -e "${RED}Error: Invalid arguments${NC}" >&2
    echo "Usage: $0 <lang>" >&2
    echo "  lang: zh or en" >&2
    exit 1
fi

LANG=$1

# Validate language
if [ "$LANG" != "zh" ] && [ "$LANG" != "en" ]; then
    echo -e "${RED}Error: lang must be 'zh' or 'en'${NC}" >&2
    exit 1
fi

# Set directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTENT_DIR="${PROJECT_ROOT}/content/${LANG}"
OUTPUT_DIR="${PROJECT_ROOT}/dist/pdf/${LANG}"
MERGED_PDF="${PROJECT_ROOT}/dist/pdf/kube-ai-hub-docs-${LANG}.pdf"
RESOURCE_PATH="${PROJECT_ROOT}:${PROJECT_ROOT}/static:${PROJECT_ROOT}/static/images"
BOOKMARK_FILE="${OUTPUT_DIR}/bookmarks.pdfmark"
SORTED_FILES_LIST="${OUTPUT_DIR}/sorted_files.txt"

# Parallel processing control files
FAIL_FLAG="${OUTPUT_DIR}/.fail_flag"
COUNTER_FILE="${OUTPUT_DIR}/.counter"
LOCK_FILE="${OUTPUT_DIR}/.lock"
LUA_FILTER_FILE="${OUTPUT_DIR}/.lua_filter"

# Determine number of parallel jobs
JOBS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

cd "$PROJECT_ROOT"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Initialize control files
rm -f "$FAIL_FLAG" "$COUNTER_FILE"
rmdir "$LOCK_FILE" 2>/dev/null || true
echo "0" > "$COUNTER_FILE"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PDF Generation for: ${LANG}${NC}"
echo -e "${BLUE}Content directory: ${CONTENT_DIR}${NC}"
echo -e "${BLUE}Output directory: ${OUTPUT_DIR}${NC}"
echo -e "${BLUE}Parallel jobs: ${JOBS}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ========================================
# Helper Functions
# ========================================

# Extract weight from frontmatter (default 0 if not found)
get_weight() {
    local file=$1
    local weight
    weight=$(grep -m1 '^weight:' "$file" 2>/dev/null | sed 's/weight:[[:space:]]*//' | tr -d ' ' || echo "0")
    if ! [[ "$weight" =~ ^[0-9]+$ ]]; then
        weight=0
    fi
    echo "$weight"
}

# Extract title from frontmatter
get_title() {
    local file=$1
    local title
    title=$(grep -m1 '^linkTitle:' "$file" 2>/dev/null | sed 's/linkTitle:[[:space:]]*//' | tr -d '"' || true)
    if [ -z "$title" ]; then
        title=$(grep -m1 '^title:' "$file" 2>/dev/null | sed 's/title:[[:space:]]*//' | tr -d '"' || true)
    fi
    if [ -z "$title" ]; then
        title=$(basename "$file" | sed 's/\.[^.]*$//')
    fi
    echo "$title"
}

# Get directory depth relative to content dir
get_depth() {
    local file=$1
    local rel_path="${file#$CONTENT_DIR/}"
    local depth=$(echo "$rel_path" | tr '/' '\n' | wc -l | tr -d ' ')
    echo "$depth"
}

# Create Lua filter for Markdown image path rewriting
IMG_BASE_VALUE="${PROJECT_ROOT}/static"
cat > "$LUA_FILTER_FILE" <<EOF
local base = "${IMG_BASE_VALUE}"

function Image(img)
  if img.src:sub(1, 8) == "/images/" then
    img.src = "file://" .. base .. "/images/" .. img.src:sub(9)
  end
  return img
end

function RawInline(el)
  if el.format == "html" then
    local function rewrite(src)
      if src:sub(1, 8) == "/images/" then
        return "file://" .. base .. "/images/" .. src:sub(9)
      end
      return src
    end
    el.text = el.text:gsub('<img%s+([^>]-)src="([^"]-)"', function(attrs, src)
      local new_src = rewrite(src)
      return '<img ' .. attrs .. 'src="' .. new_src .. '"'
    end)
  end
  return el
end
EOF

# ========================================
# Step 1: Collect and sort files by Hugo weight
# ========================================
echo -e "${BLUE}Step 1: Collecting files sorted by Hugo navigation order...${NC}"

TEMP_SORT=$(mktemp)

# Collect all .md files (excluding _index.md and _ks_components)
find "$CONTENT_DIR" \
    -path '*/_ks_components*' -prune -o \
    -name '*.md' ! -name '_index.md' -type f -print 2>/dev/null | while read -r file; do
    weight=$(get_weight "$file")
    dir_path=$(dirname "$file")
    dir_weight=0
    if [ -f "$dir_path/_index.md" ]; then
        dir_weight=$(get_weight "$dir_path/_index.md")
    fi
    printf "%06d\t%06d\t%s\n" "$dir_weight" "$weight" "$file"
done > "$TEMP_SORT"

# Also collect .adoc files
if [ "$LANG" = "zh" ]; then
    find "$CONTENT_DIR" -path '*/_ks_components' -prune -o -name '*.adoc' -type f -print 2>/dev/null | while read -r file; do
        weight=$(get_weight "$file")
        dir_path=$(dirname "$file")
        dir_weight=0
        if [ -f "$dir_path/_index.md" ]; then
            dir_weight=$(get_weight "$dir_path/_index.md")
        fi
        printf "%06d\t%06d\t%s\n" "$dir_weight" "$weight" "$file"
    done >> "$TEMP_SORT"
else
    find "$CONTENT_DIR" -path '*/_ks_components*' -prune -o -name '*.adoc' -type f -print 2>/dev/null | while read -r file; do
        weight=$(get_weight "$file")
        dir_path=$(dirname "$file")
        dir_weight=0
        if [ -f "$dir_path/_index.md" ]; then
            dir_weight=$(get_weight "$dir_path/_index.md")
        fi
        printf "%06d\t%06d\t%s\n" "$dir_weight" "$weight" "$file"
    done >> "$TEMP_SORT"
fi

# Sort all files by directory weight, then file weight
sort -t$'\t' -k1,1n -k2,2n "$TEMP_SORT" | cut -f3 > "$SORTED_FILES_LIST"
rm -f "$TEMP_SORT"

TOTAL_FILES=$(wc -l < "$SORTED_FILES_LIST" | tr -d ' ')
echo "Found ${TOTAL_FILES} files to process (sorted by Hugo weight)"
echo ""

# ========================================
# Step 2: Process files in parallel
# ========================================
echo -e "${BLUE}Step 2: Processing files in parallel (${JOBS} jobs)...${NC}"

# Export variables for subprocesses
export PROJECT_ROOT OUTPUT_DIR RESOURCE_PATH LUA_FILTER_FILE FAIL_FLAG COUNTER_FILE LOCK_FILE TOTAL_FILES CONTENT_DIR
export RED GREEN YELLOW BLUE NC

# Cross-platform atomic lock using mkdir (works on macOS and Linux)
acquire_lock() {
    while ! mkdir "$LOCK_FILE" 2>/dev/null; do
        sleep 0.01
    done
}

release_lock() {
    rmdir "$LOCK_FILE" 2>/dev/null || true
}

# Process single file function (will be called by xargs)
process_single_file() {
    local file=$1
    
    # Check if another process has failed
    if [ -f "$FAIL_FLAG" ]; then
        exit 1
    fi
    
    # Determine file type and output name
    local ext="${file##*.}"
    local output_name
    if [ "$ext" = "md" ]; then
        output_name=$(basename "$file" .md).pdf
    else
        output_name=$(basename "$file" .adoc).pdf
    fi
    local output_path="${OUTPUT_DIR}/${output_name}"
    
    # Check if already processed (resume support)
    if [ -f "$output_path" ]; then
        acquire_lock
        count=$(($(cat "$COUNTER_FILE") + 1))
        echo "$count" > "$COUNTER_FILE"
        echo -e "[${count}/${TOTAL_FILES}] ${YELLOW}[SKIP]${NC} ${output_name}"
        release_lock
        exit 0
    fi
    
    # Process file
    local success=false
    if [ "$ext" = "md" ]; then
        if pandoc "$file" \
            --resource-path="$RESOURCE_PATH" \
            --lua-filter="$LUA_FILTER_FILE" \
            --pdf-engine=weasyprint \
            -o "$output_path" 2>&1; then
            success=true
        fi
    else
        if asciidoctor-pdf \
            -a "ks_output_type=pdf" \
            -a "imagesdir=${PROJECT_ROOT}/static/images" \
            -D "$OUTPUT_DIR" \
            "$file" 2>&1; then
            success=true
        fi
    fi
    
    # Update counter and report
    acquire_lock
    count=$(($(cat "$COUNTER_FILE") + 1))
    echo "$count" > "$COUNTER_FILE"
    if [ "$success" = true ]; then
        echo -e "[${count}/${TOTAL_FILES}] ${GREEN}✓${NC} ${output_name}"
    else
        echo -e "[${count}/${TOTAL_FILES}] ${RED}✗ Failed${NC}: ${file}"
        touch "$FAIL_FLAG"
    fi
    release_lock
    
    if [ "$success" = false ]; then
        exit 1
    fi
}

export -f process_single_file acquire_lock release_lock

# Run parallel processing (use null delimiter to handle special chars in filenames)
if ! tr '\n' '\0' < "$SORTED_FILES_LIST" | xargs -0 -P "$JOBS" -I {} bash -c 'process_single_file "$@"' _ {}; then
    echo ""
    echo -e "${RED}Build failed! Check errors above.${NC}"
    rm -f "$FAIL_FLAG" "$COUNTER_FILE" "$LUA_FILTER_FILE"
    rmdir "$LOCK_FILE" 2>/dev/null || true
    exit 1
fi

# Count results
PROCESSED=$(find "$OUTPUT_DIR" -name '*.pdf' -type f | wc -l | tr -d ' ')
echo ""
echo -e "${GREEN}Processed ${PROCESSED} files${NC}"

# ========================================
# Step 3: Collect PDF files in sorted order for merging
# ========================================
echo ""
echo -e "${BLUE}Step 3: Preparing PDFs for merging...${NC}"

declare -a PDF_ORDER=()
declare -a BOOKMARK_ENTRIES=()

while IFS= read -r file; do
    [ -z "$file" ] && continue
    
    ext="${file##*.}"
    if [ "$ext" = "md" ]; then
        output_name=$(basename "$file" .md).pdf
    else
        output_name=$(basename "$file" .adoc).pdf
    fi
    output_path="${OUTPUT_DIR}/${output_name}"
    
    if [ -f "$output_path" ]; then
        PDF_ORDER+=("$output_path")
        title=$(get_title "$file")
        depth=$(get_depth "$file")
        BOOKMARK_ENTRIES+=("${depth}|${title}")
    fi
done < "$SORTED_FILES_LIST"

PDF_COUNT=${#PDF_ORDER[@]}
echo "Found ${PDF_COUNT} PDFs to merge"

# ========================================
# Step 4: Merge PDFs
# ========================================
echo ""
echo -e "${BLUE}Step 4: Merging PDFs...${NC}"

if [ "$PDF_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No PDF files to merge${NC}"
else
    [ -f "$MERGED_PDF" ] && rm -f "$MERGED_PDF"
    
    TEMP_MERGED=$(mktemp).pdf
    if pdfunite "${PDF_ORDER[@]}" "$TEMP_MERGED" 2>&1; then
        echo -e "${GREEN}✓ PDFs merged${NC}"
    else
        echo -e "${RED}✗ Merge failed${NC}"
        rm -f "$FAIL_FLAG" "$COUNTER_FILE" "$LUA_FILTER_FILE" "$SORTED_FILES_LIST"
        rmdir "$LOCK_FILE" 2>/dev/null || true
        exit 1
    fi
    
    # ========================================
    # Step 5: Generate and apply bookmarks
    # ========================================
    echo ""
    echo -e "${BLUE}Step 5: Adding Table of Contents (bookmarks)...${NC}"
    
    cat > "$BOOKMARK_FILE" <<'PDFMARK_HEADER'
%!PS-Adobe-3.0
% PDF Bookmarks

[ /Title (Kube AI Hub Documentation)
  /Author (Kube AI Hub)
  /Subject (Documentation)
  /Keywords (Kubernetes, Cloud Native)
  /DOCINFO pdfmark

PDFMARK_HEADER

    CURRENT_PAGE=1
    for i in "${!PDF_ORDER[@]}"; do
        pdf_file="${PDF_ORDER[$i]}"
        bookmark_info="${BOOKMARK_ENTRIES[$i]}"
        
        IFS='|' read -r depth title <<< "$bookmark_info"
        escaped_title=$(echo "$title" | sed 's/[()\\]/\\&/g')
        
        echo "[ /Title ($escaped_title)" >> "$BOOKMARK_FILE"
        echo "  /Page $CURRENT_PAGE" >> "$BOOKMARK_FILE"
        echo "  /View [/XYZ null null null]" >> "$BOOKMARK_FILE"
        echo "  /OUT pdfmark" >> "$BOOKMARK_FILE"
        echo "" >> "$BOOKMARK_FILE"
        
        if command -v pdfinfo &> /dev/null; then
            pages=$(pdfinfo "$pdf_file" 2>/dev/null | grep "Pages:" | awk '{print $2}' || echo "1")
        else
            pages=1
        fi
        CURRENT_PAGE=$((CURRENT_PAGE + pages))
    done
    
    echo "Generated ${#PDF_ORDER[@]} bookmark entries"
    
    if gs -dBATCH -dNOPAUSE -dQUIET \
        -sDEVICE=pdfwrite \
        -dCompatibilityLevel=1.4 \
        -sOutputFile="$MERGED_PDF" \
        "$TEMP_MERGED" \
        "$BOOKMARK_FILE" 2>&1; then
        echo -e "${GREEN}✓ Bookmarks applied successfully${NC}"
        rm -f "$TEMP_MERGED"
    else
        echo -e "${YELLOW}Warning: Could not apply bookmarks, using merged PDF without TOC${NC}"
        mv "$TEMP_MERGED" "$MERGED_PDF"
    fi
    
    echo -e "${GREEN}✓ Final PDF${NC}: ${MERGED_PDF}"
fi

# Cleanup
rm -f "$BOOKMARK_FILE" "$SORTED_FILES_LIST" "$FAIL_FLAG" "$COUNTER_FILE" "$LUA_FILTER_FILE"
rmdir "$LOCK_FILE" 2>/dev/null || true

echo ""

# ========================================
# Summary
# ========================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total PDFs: ${PDF_COUNT}"
echo -e "Merged PDF: ${MERGED_PDF}"
echo ""
echo -e "${GREEN}Done!${NC}"
