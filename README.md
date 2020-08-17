# Scalatest multiproject HTML merge

This action merges multiproject scalatest HTML reports to a single overview file.

## Inputs

### path

**Required** The name of the path. Expects the directory like this:
- Example: 
  path: test_reports/
```
  test_reports
  ├───project1
  │   ├───css
  │   ├───images
  │   ├───js
  |   ├───suite1.html
  |   ├───suite2.html
  |   ├───suite3.html
  |   └───index.html
  ├───project2
  │   ├───css
  │   ├───images
  │   ├───js
  |   ├───suite1.html
  |   └───index.html
  └───project3
      ├───css
      ├───images
      ├───js
      ├───suite1.html
      ├───suite2.html      
      └───index.html
```
## Behaviour
This action will generate an index.html containing all tests suites and correct summaries, with working links to detail pages in the root directory of the input path.
It will also copy css, images and js folders accordingly.

## Example usage
```yaml
uses: bastihav/scalatest-multiproject-html-action@v1
with:
  path: "test_reports/"
```
