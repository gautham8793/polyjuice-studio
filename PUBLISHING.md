# Publishing rules: post text for every video

These rules apply to **every agent and every person** that writes a video's `publish` block
(Claude, Gemini, or by hand in the dashboard), for both Shorts and long-form.
`tools/validate_project.py` checks them, and the dashboard's **Export** refuses to run while
there are errors. Agreed with the channel owner on Nov 6, 2026.

## 1. Facts first
- The post text may only claim what `research.md` backs **with a link to the page that says it**.
  A link to a home page (`swebench.com`, a product landing page) is not a source.
- Numbers, ranks and dates must match the source exactly, including what a number is measured
  against ("2.7× faster than the Rust port", not "2.7× faster").
- Vendor-reported results are labelled as such ("Google-reported", "per the model card").
- If the video's narration says something the sources don't support, flag it to the owner. Don't
  copy it into the post text.

## 2. Title: use up to 100 characters
- Put the hook in the first ~40 characters (all the Shorts feed shows), as a complete thought.
- Follow it with the search phrase people actually type ("CAR-T cell therapy", "Gemini 4 Argon").
- Keep emojis: one, mid-title or at the end. Emojis count as 2 characters, flags as 4.
- No "cure", "miracle", or ranks and claims beyond the sources.
- If the owner is A/B testing titles in YouTube Studio, leave `title` as it is, and don't name
  that video's title anywhere else.

## 3. Description: about 1,500–3,000 hand-written characters of real content
Export appends sources, credits and hashtags. The whole text must stay ≤ 5,000 characters, and
the Instagram caption ≤ 2,200. Write it in this order, with emoji section headers:
1. **Hook:** the first ~150 characters show before "…more".
2. **Summary:** plain English, with the search phrases worked in naturally.
3. **🔑 Key facts / steps:** 4–7 emoji bullets, every one sourced.
4. **📖 Glossary** of the terms used.
5. **❓ FAQ:** 2–4 questions people really search.
6. **Long-form:** chapters (added after voicing). **Shorts in a series:** "📺 Part N of M from
   our full … on our channel."
7. **🔔** One line about the channel.
8. **⚠️** For health or medical topics: "For education, not medical advice. Talk to your doctor
   about treatment options."

No keyword stuffing: no repeated phrases, and no tag lists in the description. YouTube's spam
policy penalizes them.

## 4. Hashtags, tags, pinned comment
- **`hashtags`:** 5–8, in the order specific → category → broad. Never more than 15 (YouTube
  then ignores all of them). The first 3 show above long-form titles. Put them in the
  description, never in the title.
  Banned: `#cart` (it means shopping cart) and `#Shorts` (YouTube detects Shorts itself).
- **`tags`** (YouTube Studio's Tags field): about 300–480 of the 500 characters, made of search
  phrases and common misspellings → `tags.txt`.
- **`pinnedComment`:** one question with an emoji, to pin under the video → `pinned-comment.txt`.

## 5. Check before export
```bash
python3 tools/validate_project.py projects/<slug>   # publish rules are part of the check
```
The dashboard's Publish tab shows the live character counts.
