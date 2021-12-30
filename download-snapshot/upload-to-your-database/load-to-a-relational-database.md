# Load to a relational database



Compared to using a data warehouse, loading the dataset into a relational database takes more work up front but lets you write simpler queries on less powerful machines. One important caveat is that this is a _lot_ of data, and exploration will be very slow in most relational databases.

We’re going to use [PostgreSQL](https://www.postgresql.org) as an example and skip the database server setup itself. We’ll assume you have a working postgres 13+ installation on which you can create schemas and tables and run queries. With that as a starting point, we'll take you through these steps:

1. Define the tables the data will be stored in and some key relationships between them (the "schema")
2. Convert the [JSON Lines](https://jsonlines.org) files you [downloaded](../download-to-your-machine.md) to [CSV](https://en.wikipedia.org/wiki/Comma-separated\_values) files that can be read by the database application. We'll flatten them to fit a [hierarchical database model](https://en.wikipedia.org/wiki/Hierarchical\_database\_model).&#x20;
3. Load the CSV data into to the tables you created.
4. Run some queries on the data you loaded

## Step 1: Create the schema

Running this SQL on your databae (in [psql](https://www.postgresql.org/docs/13/app-psql.html) for example) will initialize [this schema](load-to-a-relational-database/postgres-schema-diagram.md) for you: [https://gist.github.com/richard-orr/4c30f52cf5481ac68dc0b282f46f1905](https://gist.github.com/richard-orr/4c30f52cf5481ac68dc0b282f46f1905)

Run it and you'll be set up to follow the next steps. To show you what it's doing, we'll explain some excerpts here, using the [concept](../../about-the-data/concept.md) entity as an example.&#x20;

{% hint style="warning" %}
SQL in this section isn't anything additional you need to run. It's part of the schema we already defined in the file above.
{% endhint %}

The key thing we're doing is "flattening" the nested JSON data. Some parts of this are easy. [Concept.id](../../about-the-data/concept.md#id) is just a string, so it goes in a text column called "id":

```sql
CREATE TABLE openalex.concepts (
    id text NOT NULL,
    -- plus some other columns ...
);
```

But [Concept.related\_concepts](../../about-the-data/concept.md#related\_concepts) isn't so simple. You could store the JSON array intact in a postgres [JSON or JSONB](https://www.postgresql.org/docs/9.4/datatype-json.html) column, but you would lose much of the benefit of a relational database. It would be hard to answer questions about related concepts with more than one degree of separation, for example. So we make a separate table to hold these relationships:

```sql
CREATE TABLE openalex.concepts_related_concepts (
    concept_id text,
    related_concept_id text,
    score real
);
```

We can preserve `score` in this relationship table and look up any other attributes of the [dehydrated](../../about-the-data/#dehydrated-entity-objects) related concepts in the main table `concepts`. Creating indexes on `concept_id` and  `related_concept_id` lets up look up concepts on both sides of the relationship quickly.

## Step 2: Convert the JSON Lines files to CSV

This python script will turn the JSON Lines files you downloaded into CSV files that can be copied to the the tables you created in step 1: [https://gist.github.com/richard-orr/152d828356a7c47ed7e3e22d2253708d](https://gist.github.com/richard-orr/152d828356a7c47ed7e3e22d2253708d)

{% hint style="warning" %}
This script assumes your downloaded snapshot is in `openalex-snapshot` and you've made a directory `csv-files` to hold the CSV files.

Edit `SNAPSHOT_DIR` and `CSV_DIR` at the top of the script to read or write the files somewhere else.
{% endhint %}

{% hint style="info" %}
This script has only been tested using python 3.9.5.
{% endhint %}

Copy the script to the directory above your snapshot (if the snapshot is in `/home/yourname/openalex/openalex-snapshot/`, name it something like `/home/yourname/openalex/flatten-openalex-jsonl.py)`

run it like this:

```bash
mkdir -p csv-files
python3 flatten-openalex-jsonl.py
```

You should now have a directory full of nice, flat CSV files:

```
$ tree csv-files/
csv-files/
├── concepts.csv
├── concepts_ancestors.csv
├── concepts_counts_by_year.csv
├── concepts_ids.csv
└── concepts_related_concepts.csv
...
$ cat csv-files/concepts_related_concepts.csv
concept_id,related_concept_id,score
https://openalex.org/C41008148,https://openalex.org/C33923547,253.92
https://openalex.org/C41008148,https://openalex.org/C119599485,153.019
https://openalex.org/C41008148,https://openalex.org/C121332964,143.935
...
```

## Step 3: Load the CSV files to the database

Now we run one postgres copy command to load each CSV file to its corresponding table. Each command looks like this:

```
\copy openalex.concepts from csv-files/concepts.csv csv header
```

This script will run all the copy commands in the right order: [https://gist.github.com/richard-orr/a1117d7dd618970a1af23fa4b54c4da4](https://gist.github.com/richard-orr/a1117d7dd618970a1af23fa4b54c4da4). To run it:

* Copy it to the same place as the python script from step 2, right above the folder with your CSV files.
* Set the environment variable OPENALEX\_SNAPSHOT\_DB to the [connection URI](https://www.postgresql.org/docs/13/libpq-connect.html#LIBPQ-CONNSTRING) for your database.
* If your CSV files aren't in `csv-files`, replace each occurence of 'csv-files/' in the script with the correct path.
* Run it like this:

```
psql $OPENALEX_SNAPSHOT_DB < copy-openalex-csv.sql
```

There are a bunch of ways you can do this - just run the copy commands from the script above in the right order in whatever client you're familiar with.

## &#x20;Step 4: Run your queries!