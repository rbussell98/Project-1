# RESULTS

Pipeline: crop+CLIP image ranking, 9.6k popular index, OCR->MusicBrainz candidates. Test photos are synthetic phone-photo degradations of CAA covers (30 albums, 26 use a different edition image than the candidate thumbnail).

### mild: top-1 22/30 (73%), top-3 24/30 (80%); runtime mean 5.3s median 2.7s (warm caches); fast-path (index only) 7/30; stage-B used 8
- same-edition photo: top-1 2/4, top-3 2/4
- different-edition photo: top-1 20/26, top-3 22/26
- style hiphop: top-1 3/5
- style jazz: top-1 1/5
- style minimal: top-1 7/7
- style notext: top-1 3/3
- style rock: top-1 3/4
- style stylized: top-1 5/6

| Album | Style | Edition | Rank | OCR read | Top-1 returned | Time s |
|---|---|---|---|---|---|---|
| Jack Johnson - Meet the Moonlight | stylized | same | 1 | - | Jack Johnson - Meet the Moonlight (0.968) | 1.6 (fast) |
| Jack Johnson - In Between Dreams | stylized | alt | 1 | Jack Johnson | Jack Johnson - In Between Dreams (0.881) | 6.7 |
| Miles Davis - Kind of Blue | jazz | alt | 2 | Kind of Blue / BY ANALOGUE PRODUCTIONS | Miles Davis - Miles Davis (0.807) | 1.5 |
| John Coltrane - A Love Supreme | jazz | alt | miss | COLTRANE / preme | John Coltrane - John Coltrane 1926-1967 (0.829) | 1.7 |
| Herbie Hancock - Maiden Voyage | jazz | alt | miss | Oyage / Maide | Maize - Maize (0.762) | 3.4 |
| Dave Brubeck - Time Out | jazz | same | 1 | time out / fave Brubeck | Dave Brubeck - Time Out (0.952) | 13.9 |
| Nirvana - Nevermind | rock | alt | 1 | SUPER DELUKE / SUPER DELUXE | Nirvana - Nevermind (0.842) | 22.4 |
| Pink Floyd - The Dark Side of the Moon | notext | alt | 1 | - | Pink Floyd - The Dark Side of the Moon (0.943) | 0.8 (fast) |
| Led Zeppelin - Led Zeppelin IV | notext | alt | 1 | peed | Led Zeppelin - [Led Zeppelin IV] (0.849) | 0.9 |
| The Beatles - Abbey Road | notext | alt | 1 | ver Fy | The Beatles - Abbey Road (0.931) | 0.8 |
| Radiohead - OK Computer | rock | alt | 1 | OKNOTOK / OK COMPUTER | Radiohead - OK Computer (0.867) | 1.0 |
| Fleetwood Mac - Rumours | rock | alt | 1 | - | Fleetwood Mac - Rumours (0.855) | 0.8 |
| Kendrick Lamar - good kid, m.A.A.d city | hiphop | alt | miss | Eat id | Lil Yachty - Lil Boat 3 (0.773) | 0.8 |
| Nas - Illmatic | hiphop | alt | 1 | CLASSICS / CLE AR | Nas - Illmatic (0.798) | 2.0 |
| Wu-Tang Clan - Enter the Wu-Tang (36 Chambers) | hiphop | alt | 1 | ENTER / 30 CHAMBE ny | Wu‐Tang Clan - Enter the Wu‐Tang (36 Chambers) ( | 7.8 |
| Kanye West - My Beautiful Dark Twisted Fantasy | hiphop | same | miss | - | St. Vincent - MASSEDUCTION (0.766) | 6.2 |
| Tame Impala - Currents | stylized | alt | 1 | TAME MRALA / NANT | Tame Impala - Currents (0.856) | 8.9 |
| Frank Ocean - Blonde | minimal | alt | 1 | - | Frank Ocean - Blonde (0.988) | 0.8 (fast) |
| Bon Iver - For Emma, Forever Ago | minimal | alt | 1 | - | Bon Iver - For Emma, Forever Ago (0.931) | 0.8 (fast) |
| Daft Punk - Random Access Memories | stylized | alt | miss | - | Deep Purple - The House of Blue Light Interview  | 3.9 |
| Norah Jones - Come Away With Me | minimal | alt | 1 | - | Norah Jones - Come Away With Me (0.932) | 0.8 (fast) |
| Stevie Wonder - Songs in the Key of Life | stylized | alt | 1 | iach | Stevie Wonder - Songs in the Key of Life (0.891) | 5.2 |
| The Strokes - Is This It | minimal | alt | 1 | THE STROKES IS THIS IT / THE STROKES IS THIS I | The Strokes - Is This It (0.893) | 9.6 |
| Amy Winehouse - Back to Black | minimal | alt | 1 | - | Amy Winehouse - Back to Black (0.827) | 5.1 |
| Bill Evans - Waltz for Debby | jazz | same | miss | BILL EVANS / il EVANS | Bill Evans - Evans in England (0.748) | 10.4 |
| Taylor Swift - Folklore | minimal | alt | 1 | - | Taylor Swift - folklore (0.812) | 10.7 |
| Beach House - Depression Cherry | stylized | alt | 1 | beach house / depression cherry | Beach House - Depression Cherry (0.792) | 10.5 |
| Arctic Monkeys - AM | minimal | alt | 1 | - | Arctic Monkeys - AM (0.966) | 0.8 (fast) |
| Michael Jackson - Thriller | rock | alt | 2 | SELLING ALBUM / for All Time | Michael Jackson - Off the Wall (0.811) | 19.2 |
| Lauryn Hill - The Miseducation of Lauryn Hill | hiphop | alt | 1 | - | Lauryn Hill - The Miseducation of Lauryn Hill (0 | 0.8 (fast) |

### harsh: top-1 17/30 (56%), top-3 18/30 (60%); runtime mean 7.3s median 5.2s (warm caches); fast-path (index only) 7/30; stage-B used 9
- same-edition photo: top-1 2/4, top-3 2/4
- different-edition photo: top-1 15/26, top-3 16/26
- style hiphop: top-1 3/5
- style jazz: top-1 1/5
- style minimal: top-1 4/7
- style notext: top-1 2/3
- style rock: top-1 2/4
- style stylized: top-1 5/6

| Album | Style | Edition | Rank | OCR read | Top-1 returned | Time s |
|---|---|---|---|---|---|---|
| Jack Johnson - Meet the Moonlight | stylized | same | 1 | - | Jack Johnson - Meet the Moonlight (0.945) | 1.3 (fast) |
| Jack Johnson - In Between Dreams | stylized | alt | 1 | vert | Jack Johnson - In Between Dreams (0.852) | 16.3 |
| Miles Davis - Kind of Blue | jazz | alt | miss | UHQR / MILES VIS | Miles Davis - Muted Miles (0.751) | 18.7 |
| John Coltrane - A Love Supreme | jazz | alt | miss | - | John Coltrane - A Jazz Hour With John Coltrane:  | 4.6 |
| Herbie Hancock - Maiden Voyage | jazz | alt | miss | oy spe | Deep Purple - The House of Blue Light Interview  | 8.2 |
| Dave Brubeck - Time Out | jazz | same | 1 | gave brobeck / time out | Dave Brubeck - Time Out (0.917) | 17.1 |
| Nirvana - Nevermind | rock | alt | miss | SUPER DELUXE / UPER DELUKE | Super Deluxe - Via Satellite (0.754) | 9.8 |
| Pink Floyd - The Dark Side of the Moon | notext | alt | 1 | - | Pink Floyd - The Dark Side of the Moon (0.949) | 0.8 (fast) |
| Led Zeppelin - Led Zeppelin IV | notext | alt | miss | - | Pink Floyd - Moonlight Tunes (0.826) | 4.9 |
| The Beatles - Abbey Road | notext | alt | 1 | - | The Beatles - Abbey Road (0.918) | 0.8 (fast) |
| Radiohead - OK Computer | rock | alt | 1 | OK COMPUTER / OX COMPUTER | Radiohead - OK Computer (0.859) | 2.8 |
| Fleetwood Mac - Rumours | rock | alt | 1 | MARY | Fleetwood Mac - Rumours (0.792) | 16.7 |
| Kendrick Lamar - good kid, m.A.A.d city | hiphop | alt | miss | - | Deep Purple - The House of Blue Light Interview  | 3.8 |
| Nas - Illmatic | hiphop | alt | 1 | malic | Nas - Illmatic (0.845) | 9.0 |
| Wu-Tang Clan - Enter the Wu-Tang (36 Chambers) | hiphop | alt | 1 | ENTER / CIV TANG | Wu‐Tang Clan - Enter the Wu‐Tang (36 Chambers) ( | 13.7 |
| Kanye West - My Beautiful Dark Twisted Fantasy | hiphop | same | miss | - | The Mars Volta - Octahedron (0.770) | 5.6 |
| Tame Impala - Currents | stylized | alt | 1 | - | Tame Impala - Currents (0.847) | 6.4 |
| Frank Ocean - Blonde | minimal | alt | 1 | - | Frank Ocean - Blonde (0.951) | 0.8 (fast) |
| Bon Iver - For Emma, Forever Ago | minimal | alt | 2 | Bon Iver / Bon Iver fm Guana | Bon Iver - Bon Iver, Bon Iver (0.771) | 22.9 |
| Daft Punk - Random Access Memories | stylized | alt | miss | - | Autechre - AE_LIVE_HELSINKI_141116 (0.781) | 4.6 |
| Norah Jones - Come Away With Me | minimal | alt | 1 | - | Norah Jones - Come Away With Me (0.910) | 0.8 (fast) |
| Stevie Wonder - Songs in the Key of Life | stylized | alt | 1 | - | Stevie Wonder - Songs in the Key of Life (0.879) | 4.0 |
| The Strokes - Is This It | minimal | alt | miss | - | Nine Inch Nails - The Fragile (0.861) | 3.8 |
| Amy Winehouse - Back to Black | minimal | alt | 1 | - | Amy Winehouse - Back to Black (0.749) | 4.3 |
| Bill Evans - Waltz for Debby | jazz | same | miss | BILL EVANS / WALTLH | Bill Evans - A Jazz Hour With Bill Evans: Autumn | 5.5 |
| Taylor Swift - Folklore | minimal | alt | miss | A Tyr | Malcolm Todd - Malcolm Todd (0.785) | 6.1 |
| Beach House - Depression Cherry | stylized | alt | 1 | depression cherry / beach house | Beach House - Depression Cherry (0.858) | 6.8 |
| Arctic Monkeys - AM | minimal | alt | 1 | - | Arctic Monkeys - AM (0.932) | 0.8 (fast) |
| Michael Jackson - Thriller | rock | alt | miss | for All Time / Konye West | Miles Davis - Live at Hill Auditorium, Ann Arbor | 17.3 |
| Lauryn Hill - The Miseducation of Lauryn Hill | hiphop | alt | 1 | - | Lauryn Hill - The Miseducation of Lauryn Hill (0 | 0.8 (fast) |

### real: top-1 2/2 (100%), top-3 2/2 (100%); runtime mean 1.1s median 1.1s (warm caches); fast-path (index only) 2/2; stage-B used 0

| Album | Style | Edition | Rank | OCR read | Top-1 returned | Time s |
|---|---|---|---|---|---|---|
| Jack Johnson - Meet the Moonlight | real-screenshot | same | 1 | - | Jack Johnson - Meet the Moonlight (0.957) | 1.3 (fast) |
| Jack Johnson - In Between Dreams | real-scan | same | 1 | - | Jack Johnson - In Between Dreams (0.925) | 0.8 (fast) |

## Notes
- Runtimes in tables are WARM (MusicBrainz/CAA/OCR caches filled). Cold runs seen in the first pass: fast path (visual index only) about 1.5 s; OCR+MusicBrainz path about 8-25 s (OCR 2-6 s with 3 Node workers, 2-3 MusicBrainz requests at >=1.1 s, 40 thumbnails at 10 parallel, CLIP about 70 ms per image in Node). Under 10 s only holds when the fast path accepts or the OCR path is lucky; browser WASM will be slower.
- 25 of 30 test albums are in the 9.6k visual index (built from popular artists, so this flatters recall for popular albums). A held-out run (index excluding the test albums) was NOT completed in time. Albums outside the index depend on OCR + MusicBrainz, where only about half of the covers had readable text.
- 26 of 30 photos use a DIFFERENT edition's front image from the one used as the candidate thumbnail (CAA often holds photos of vinyl sleeves, obi strips, box sets). That is a deliberately hard test; same-edition photos are only 4 here, so that subset is too small to quote.
- Remaining misses: A Love Supreme (Japanese obi edition), Maiden Voyage, good kid m.A.A.d city (photo of black vinyl sleeve, different art from the CAA front), MBDTF, Waltz for Debby, Thriller (different art), Kind of Blue (ties with a duplicate 'Miles Davis - Miles Davis' group with same art).
