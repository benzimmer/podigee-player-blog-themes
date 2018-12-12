const fs = require('fs')
const axios = require('axios')
const https = require('https')
const server = require('server')
const { get, post, error } = server.router
const { render, redirect, file, type, status } = server.reply

const podcastId = process.argv[3]
const apiKey = process.argv[2]
let apiEndpoint
if (process.env['MODE'] === 'development') {
  apiEndpoint = 'https://app.podigee.de:3000/api/v1'
} else {
  apiEndpoint = 'https://app.podigee.com/api/v1'
}

const MiniLiquid = {
  readWithIncludes: (fileName) => {
    let parent = fs.readFileSync(`files/${fileName}`).toString()

    const matches = parent.match(/{% include '(.*)' %}/g)
    if (matches) {
      matches.map((match) => {
        const obj = {}
        const includeName = match.match(/'(.*)'/)[1]
        return [match, fs.readFileSync(`files/${includeName}`).toString()]
      }).forEach((include) => {
        parent = parent.replace(include[0], include[1])
      })
    }

    return parent
  }
}

const Api = (endpoint, key) => {
  const client = axios.create({
    baseURL: endpoint,
    headers: {
      'Token': key
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  })

  const request = (action, params) => {
    params = Object.assign({ podcast_id: podcastId }, params)
    const templates = {
      layout: MiniLiquid.readWithIncludes('layout.html'),
    }
    templates[action] = MiniLiquid.readWithIncludes(`${action}.html`)
    return client.post('themes/render', {
      page_name: action,
      params: params,
      templates: templates
    })
  }

  const index = (page) => {
    return request('index', { page: page })
  }

  const show = (episodeId) => {
    return request('show', { episode_id: episodeId })
  }

  const page = (path) => {
    return request(path, {})
  }

  return {
    index: index,
    show: show,
    page: page
  }
}

const api = Api(apiEndpoint, apiKey)

const respond = async (promise) => {
  const data = await promise
  return type('text/html').send(data.data)
}

controllers = {
  index (ctx) {
    const data = api.index(ctx.query.page)
    return respond(data)
  },
  show (ctx) {
    const episodeId = parseInt(ctx.params.id)
    const data = api.show(episodeId)
    return respond(data)
  },
  about (ctx) {
    const data = api.page('about')
    return respond(data)
  },
  archive (ctx) {
    const data = api.page('archive')
    return respond(data)
  },
  imprint (ctx) {
    const data = api.page('imprint')
    return respond(data)
  },
  privacyPolicy (ctx) {
    const data = api.page('privacy-policy')
    return respond(data)
  },
  applicationCss (ctx) {
    return type('text/css').send(fs.readFileSync('files/application.css'))
  }
}

const options = {
  port: 9000,
  views: 'files'
}

server(options, [
  get('/', controllers.index),
  get('/about', controllers.about),
  get('/archive', controllers.archive),
  get('/imprint', controllers.imprint),
  get('/privacy-policy', controllers.privacyPolicy),
  get('/:id', controllers.show),
  get('/stylesheets/application.css', controllers.applicationCss),
  // error(ctx => {
    // console.log('=======', ctx.error)
    // return status(500).send('An error occurred')
  // })
])
