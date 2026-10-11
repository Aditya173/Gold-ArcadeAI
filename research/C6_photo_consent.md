# C6: Photo consent, on-device processing and publishing

*Background research, sources checked 2026-10-11. **Not legal advice.** Company disclosures are
stated practice, not audited behaviour. **UNSOURCED** marks product judgment and proposed copy.*

## Findings

- **Three separate user decisions:** which photos are read, which inferred labels are kept, and
  what is published. A public storefront can default to the maker's product images, with each
  original photo published only if the person opts in for that photo (UNSOURCED recommendation).
- **Start with the system photo picker.** `PHPickerViewController` / SwiftUI `PhotosPicker` return
  only the photos the person chose, and need no library permission prompt. Reading the whole
  library is a separate feature, with a specific `NSPhotoLibraryUsageDescription`. Apple rejects
  vague purpose strings such as "improve your experience". Treat limited access as a normal mode.
  Use `authorizationStatus(for: .readWrite)`, because the legacy call reports `.authorized` even
  when access is limited. Limited access dates from iOS 14, not iOS 18.
- **"On-device" does not mean "Data Not Collected"** on the App Store privacy label once any
  derived data (a storefront, a product list, labels) leaves the phone. Under GDPR, on-device
  analysis is still processing, and inferring taste is profiling.
- **Faces carry the legal risk.** App Review 5.1.2(vi) bars using face-mapping data for marketing.
  Illinois BIPA covers scans of face geometry, with $1,000/$5,000 statutory damages per violation.
  Google settled an Illinois Face Grouping case for $100M. The FTC made Everalbum delete face
  embeddings and the models built from them. Any feature that recognises recurring people is in
  this category. UNSOURCED recommendation: keep it out of a commercial pipeline unless consent is
  designed for it, and never build persistent face templates just to flag people.
- **"It all stays on the device" is not a defence.** *Monroy v. Shutterfly* rejected the "these
  are just photos" argument for face templates extracted from them.
- **Other people and ownership:** California §3344 covers commercial use of another person's
  likeness. The photographer, not the phone's owner, generally owns the copyright, which matters
  for wedding photos.

## Apple photo access

| Mechanism | Permits |
|---|---|
| `.addOnly` | Adding to Photos; not reading. [Apple](https://developer.apple.com/documentation/photos/phaccesslevel) |
| `.readWrite` + `.authorized` | Full library. [WWDC20](https://developer.apple.com/videos/play/wwdc2020/10641/) |
| `.readWrite` + `.limited` | Only the photos the user selected; arrived in iOS 14 |
| `PHPicker` / `PhotosPicker` | Returns selected items; no library authorisation needed. [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10107/) |

- `presentLimitedLibraryPicker(from:)` lets the person change their selection.
  `PHPhotoLibraryPreventAutomaticLimitedAccessAlert` suppresses the automatic reminder
  ([Apple](https://developer.apple.com/documentation/photos/phphotolibrary/presentlimitedlibrarypicker%28from%3A%29)).
- iOS 17 added embedded pickers and an Options menu for excluding location; metadata is included
  by default. It also redesigned the full-access prompt and added periodic reminders
  ([WWDC23 privacy](https://developer.apple.com/videos/play/wwdc2023/10053/)).
- Purpose strings: `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` and
  `NSCameraUsageDescription` must say specifically what they are for
  ([guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings/)).

**Relevant App Review sections** ([guidelines](https://developer.apple.com/app-store/review/guidelines/)):
5.1.1 (privacy policy, consent, minimisation, account deletion), 5.1.2 (third-party and AI sharing
needs permission; no secret profiles; no contacting people found in Photos; face-mapping data not
used for marketing), 1.2 / 1.6 (user content, security), 1.3 / 5.1.4 (children), 5.2 (content
rights). Privacy labels: [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

## How comparable apps disclose photo handling

| App | Disclosed handling | Documented trouble |
|---|---|---|
| Remini. [Policy](https://support.bendingspoons.com/privacy?app=1470373330) | Uploads only what is chosen; AI training is opt-in; short retention | Criticised for body edits. [TechCrunch](https://techcrunch.com/2023/07/20/remini-tops-the-app-store-for-its-viral-ai-headshots-but-its-body-edits-go-too-far-some-say/) |
| Lensa. [Policy](https://lensa.app/privacy/) | Edits on device; some features in the cloud with 24 h retention | BIPA suit dismissed on standing and jurisdiction, not on the merits. [Order](https://law.justia.com/cases/federal/district-courts/illinois/ilndce/1:2023cv01566/431303/44/) |
| Day One. [AI](https://dayoneapp.com/guides/ai-features/ai-features/) | Separates on-device, hosted and third-party AI; asks before first use | A 2018 sync incident hit 106 accounts. [Postmortem](https://dayoneapp.com/blog/may-2018-day-one-outage-postmortem/) |
| Retro. [Policy](https://retro.app/privacy) | Public profiles; locations visible to friends by default | No enforcement found |
| Google Photos. [Face Groups](https://support.google.com/photos/answer/6128838?hl=en) | Face models deleted when the feature is turned off | $100M Illinois settlement. [Notice](https://www.classaction.org/media/google-bipa-settlement-notice.pdf) |
| Everalbum. [FTC](https://www.ftc.gov/news-events/news/press-releases/2021/05/ftc-finalizes-settlement-photo-app-developer-related-misuse-facial-recognition-technology) | — | Ordered to delete face embeddings and the models built from them |

## GDPR, CCPA, BIPA

- **GDPR:** photos become biometric data only when processed in a specific technical way that can
  uniquely identify someone ([Art. 4(14), Art. 9, Recital 51](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)).
  Singling a person out counts as recognition even without a name
  ([ICO](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/biometric-data-guidance-biometric-recognition/biometric-recognition/)).
  Inferring taste is profiling ([EDPB](https://www.edpb.europa.eu/topics/ai-and-technology/automated-decision-making-profiling-and-online-tracking_en)).
  Each purpose needs its own legal basis and its own consent choice
  ([EDPB](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en)).
  People who appear in the photos have rights too
  ([EDPB](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)). A DPIA
  (a written risk assessment done before processing) is required for high-risk processing
  ([EDPB](https://www.edpb.europa.eu/topics/accountability-and-compliance-tools/data-protection-impact-assessment_en)).
- **CCPA:** applies to qualifying businesses. Preference inferences are personal information;
  precise location and identifying biometrics are sensitive
  ([CPPA FAQ](https://www.cppa.ca.gov/faq.html), [§1798.100](https://codes.findlaw.com/ca/civil-code/civ-sect-1798-100/)).
- **BIPA:** ordinary photos are excluded, but scans of face geometry are covered. It requires prior
  written notice and a release, public rules on retention, and no profiting from biometric data
  ([BIPA](https://law.justia.com/codes/illinois/chapter-740/act-740-ilcs-14/)). Cases go both
  ways: [Monroy v. Shutterfly](https://www.govinfo.gov/content/pkg/USCOURTS-ilnd-1_16-cv-10984/pdf/USCOURTS-ilnd-1_16-cv-10984-0.pdf)
  against [Zellmer v. Meta](https://cdn.ca9.uscourts.gov/datastore/opinions/2024/06/17/22-16925.pdf).

## Publishing a storefront

| Issue | Source |
|---|---|
| Other people's likeness | [Cal. Civ. Code §3344](https://law.justia.com/codes/california/code-civ/division-4/part-1/title-2/chapter-2/article-3/section-3344/) |
| Photo ownership | [US Copyright Office](https://www.copyright.gov/engage/photographers/) |
| Location (metadata, plus visible landmarks) | [Apple](https://support.apple.com/guide/personal-safety/manage-location-metadata-in-photos-ips0d7a5df82/1.0/web/1.0), [Google](https://support.google.com/photos/answer/11190100?hl=en) |
| Minors | [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions); GDPR Art. 8 sets 16 (13 in some countries) |
| Affiliate commission | [FTC endorsement guides](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking) |

## Launch checklist (UNSOURCED proposed controls, not legal sufficiency)

- [ ] Explain the analysis before the person picks photos. Offer "Choose photos", "Build
      manually" and "Learn more".
- [ ] A specific purpose string if PhotoKit is used. Request saving separately.
- [ ] Say exactly what is uploaded to create the public page. Source photos stay on the phone
      unless the person chooses otherwise.
- [ ] Separate consent for any cloud AI, naming the provider, the retention period and the use.
      Model training is a separate choice.
- [ ] Let the person view, edit and reset the inferred labels, and exclude photos.
- [ ] Original-photo publishing off by default; per-image opt-in with crop/blur, location
      stripping, and a review for people, minors, addresses and documents.
- [ ] Show an exact public preview before publishing. Later analysis never silently updates the
      live page.
- [ ] Separate controls: manage access, stop analysis, clear profile, remove an image, unpublish,
      delete account.
- [ ] Before release, test cancel/denied/limited access, that no photos or templates are uploaded
      by accident, that metadata is stripped, that the preview is accurate, and that deletion
      clears caches and previews.
