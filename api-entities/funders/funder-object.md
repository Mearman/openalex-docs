# Funder object

These are the fields in a funder object. When you use the API to get a single funder or lists of funders, this is what's returned.

### `alternate_titles`

_List:_ A list of alternate titles for this funder.

```json
alternate_titles: [
  "US National Institutes of Health",
  "Institutos Nacionales de la Salud",
  "NIH",
]
```

### `cited_by_count`

_Integer:_ The total number [`Works`](../works/work-object/) that cite a work linked to this funder.


```json
cited_by_count: 7823467
```

### `country_code`

_String:_ The country where this funder is located, represented as an [ISO two-letter country code](https://en.wikipedia.org/wiki/ISO\_3166-1\_alpha-2).

```json
country_code: "US"
```

### `counts_by_year`

_List:_ The values of [`works_count`](#works_count) and [`cited_by_count`](publisher-object.md#cited\_by\_count) for _each_ of the last ten years, binned by year. To put it another way: for every listed year, you can see how many new works are linked to this funder, and how many times _any_ work linked to this funder was cited.

Years with zero citations and zero works have been removed so you will need to add those back in if you need them.

```json
counts_by_year: [
    {
        year: 2021,
        works_count: 4211,
        cited_by_count: 120939
    },
    {
        year: 2020,
        works_count: 4363,
        cited_by_count: 119531
    },
    
    // and so forth
]
```

### `created_date`

_String:_ The date this `Funder` object was created in the OpenAlex dataset, expressed as an [ISO 8601](https://en.wikipedia.org/wiki/ISO\_8601) date string.

```json
created_date: "2023-02-13"
```

### `description`

_String:_ A short description of this funder, taken from [Wikidata](#ids).

```json
description: "medical research organization in the United States"
```

### `display_name`

_String:_ The primary name of the funder.

```json
display_name: "National Institutes of Health"
```

### `homepage_url`

_String:_ The URL for this funder's primary homepage.

```json
homepage_url: "http://www.nih.gov/"
```

### `id`

_String:_ The OpenAlex ID for this funder.

```json
id: "https://openalex.org/F4320332161"
```

### `ids`

_Object:_ All the external identifiers that we know about for this funder. IDs are expressed as URIs whenever possible. Possible ID types:

* `openalex` _String:_ this funder's [OpenAlex ID](../../how-to-use-the-api/get-single-entities/#the-openalex-id)
* `ror` _String:_ this funder's ROR ID
* `wikidata` _String:_ this funder's [Wikidata ID](https://www.wikidata.org/wiki/Wikidata:Identifiers)

```json
ids: {
    openalex: "https://openalex.org/F4320332161",
    ror: "https://ror.org/01cwqze88",
    wikidata: "https://www.wikidata.org/entity/Q390551"
}
```

### `image_thumbnail_url`

_String:_ Same as [`image_url`](publisher-object.md#image\_url-1), but it's a smaller image.

This is usually a hotlink to a wikimedia image. You can change the `width=300` parameter in the URL if you want a different thumbnail size.

```json
image_thumbnail_url: "https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/NIH 2013 logo vertical.svg&width=300"
```

### `image_url`

_String:_ URL where you can get an image representing this funder. Usually this a hotlink to a Wikimedia image, and usually it's a seal or logo.

```json
image_url: "https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/NIH 2013 logo vertical.svg"
```

### `summary_stats`

_Object:_ Citation metrics for this funder

* `2yr_mean_citedness` _Float_: The 2-year mean citedness for this funder. Also known as [impact factor](https://en.wikipedia.org/wiki/Impact_factor).
* `h_index` _Integer_: The [_h_-index](https://en.wikipedia.org/wiki/H-index) for this funder.
* `i10_index` _Integer_: The [i-10 index](https://en.wikipedia.org/wiki/Author-level_metrics#i-10-index) for this funder.

While the _h_-index and the i-10 index are normally author-level metrics and the 2-year mean citedness is normally a journal-level metric, they can be calculated for any set of papers, so we include them for funders.

```json
summary_stats: {
    2yr_mean_citedness: 5.065784263815827,
    h_index: 985,
    i10_index: 176682
}
```

### `updated_date`

_String:_ The last time anything in this funder object changed, expressed as an [ISO 8601](https://en.wikipedia.org/wiki/ISO\_8601) date string. This date is updated for _any change at all_, including increases in various counts.

```json
updated_date: "2023-04-21T16:54:19.012138"
```

### `works_count`

_Integer:_ The number of works linked to this funder.

```json
works_count: 260210
```