# ImgCollect

- Specify search term and save location
- Click `Search` and wait until canvas is displayed
- Use `Next` to discard image and `Save` to save to disk
- Draw on the image or crop it before saving

Program may not work correctly due to changes with the search engines and CORS.

# Files

- `index.ts`: Backend, responsible for opening puppeteer and scraping all images

- `renderer.ts`: Frontend, responsible for getting all form values and displaying images

# Download

Downloads for Windows are available under the [Releases Tab](https://github.com/Keilo75/HS-ImgCollect/releases). Latest release can be found [here](https://github.com/Keilo75/HS-ImgCollect/releases/latest).

Other platforms must be compiled from source and may not work. To compile from source, clone the repository and run `yarn start` or `yarn package`.

# Related

[Python Scripts](https://github.com/Keilo75/HS-Python-Scripts)
