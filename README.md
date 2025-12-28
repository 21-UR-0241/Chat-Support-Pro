# Multi-Store Shopify Chat App

A complete live chat application for Shopify that supports multiple stores with real-time messaging, customer context integration, and a beautiful admin panel.

## 🌟 Features

- **Multi-Tenant Architecture**: Supports multiple Shopify stores with data isolation
- **Real-Time Chat**: WebSocket-powered bidirectional communication
- **Customer Context**: Automatic integration with Shopify customer data and order history
- **Customizable Widget**: Merchants can customize colors and messages
- **Mobile Responsive**: Works seamlessly on all devices
- **OAuth Authentication**: Secure multi-store installation flow
- **Professional Admin Panel**: Three-column layout with conversation management
- **Theme App Extension**: Easy installation via Shopify theme editor

## 📁 Project Structure

```
shopify-chat-app/
├── backend/
│   ├── server.js              # Main Express server
│   ├── shopify-auth.js        # OAuth authentication
│   ├── shopify-handler.js     # Shopify API interactions
│   ├── database.js            # PostgreSQL database layer
│   ├── websocket-server.js    # WebSocket server
│   └── middleware.js          # Express middleware
├── frontend/
│   ├── widget/
│   │   ├── ChatWidget.jsx     # Customer-facing widget
│   │   └── widget-build.js    # Build configuration
│   ├── admin/
│   │   ├── MerchantPanel.jsx  # Merchant dashboard
│   │   └── index.html         # Admin panel HTML
│   └── shared/
│       └── utils.js           # Shared utilities
├── extensions/
│   └── chat-widget/           # Shopify theme extension
├── .env.example               # Environment variables template
├── package.json               # Dependencies and scripts
├── shopify.app.toml           # Shopify app configuration
└── README.md                  # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Shopify Partner account
- A Shopify development store

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd shopify-chat-app
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```sql
CREATE DATABASE shopify_chat;
```

The application will automatically create the required tables on first run.

### 3. Environment Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Shopify App
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app.com
HOST=your-app.com
SCOPES=read_customers,read_orders,write_script_tags

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_chat

# Server
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=*

# Widget CDN
WIDGET_CDN_URL=https://cdn.yourdomain.com/dist
```

### 4. Build the Widget

```bash
npm run widget:build
```

This creates the bundled widget files in the `dist/` directory.

### 5. Start Development Server

```bash
npm run dev
```

This runs both the backend server and widget build in watch mode.

## 📦 Deployment

### Backend Deployment (Railway/Render/Fly.io)

1. **Railway**:
   ```bash
   railway login
   railway init
   railway up
   ```

2. **Render**:
   - Connect your repository
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables

3. **Fly.io**:
   ```bash
   fly launch
   fly deploy
   ```

### Widget CDN Deployment

Upload the `dist/` folder contents to a CDN:

1. **Cloudflare Pages**:
   ```bash
   npx wrangler pages deploy dist/
   ```

2. **AWS S3 + CloudFront**:
   ```bash
   aws s3 sync dist/ s3://your-bucket/
   ```

3. **Netlify**:
   ```bash
   netlify deploy --dir=dist --prod
   ```

### Database Deployment

Use a managed PostgreSQL service:

- **Railway**: Automatic PostgreSQL addon
- **Render**: PostgreSQL service
- **Supabase**: Free PostgreSQL hosting
- **AWS RDS**: Production-grade PostgreSQL

## 🔧 Configuration

### Shopify App Setup

1. Create a new app in your Shopify Partner dashboard
2. Set the app URL to your deployed backend URL
3. Set the redirect URL to `https://your-app.com/auth/callback`
4. Copy API key and secret to `.env`

### Theme Extension Setup

1. Navigate to `extensions/chat-widget`
2. Update the default `widget_script_url` in `chat-widget.liquid`
3. Deploy the extension:
   ```bash
   shopify app deploy
   ```

### Merchant Installation

Merchants install the app via:

1. Install from Shopify App Store (or provide installation link)
2. Authorize the app (OAuth flow)
3. Add chat widget to theme via theme editor
4. Configure colors and welcome message
5. Access admin panel to respond to chats

## 🏗️ Architecture

### Multi-Store Data Isolation

Each shop's data is isolated using the `shop_id` column:

```sql
-- All queries include shop_id filter
SELECT * FROM conversations WHERE shop_id = $1;
```

### Real-Time Communication

```
Customer Widget <--WebSocket--> Server <--WebSocket--> Merchant Panel
                      ↓
                PostgreSQL Database
                      ↓
                Shopify API (Customer/Order Data)
```

### OAuth Flow

```
1. Merchant clicks "Install"
2. Redirect to Shopify authorization
3. Shopify redirects to /auth/callback with code
4. Exchange code for access token
5. Save shop credentials to database
6. Redirect to app dashboard
```

## 🔒 Security

- **Shop Verification**: All API routes verify shop domain header
- **Data Isolation**: Queries filtered by shop_id
- **HMAC Verification**: Webhooks validated with HMAC
- **Input Sanitization**: All user inputs validated
- **Rate Limiting**: API endpoints rate limited
- **CORS**: Configured for specific origins in production

## 📊 Database Schema

### shops
- `id`: Primary key
- `shop_domain`: Unique shop domain
- `access_token`: Shopify access token
- `scope`: Granted scopes
- `is_active`: Shop status
- `installed_at`, `updated_at`: Timestamps

### conversations
- `id`: Primary key
- `shop_id`: Foreign key to shops
- `customer_email`, `customer_name`: Customer info
- `customer_id`: Shopify customer ID
- `status`: open/closed
- `created_at`, `updated_at`: Timestamps

### messages
- `id`: Primary key
- `conversation_id`: Foreign key to conversations
- `sender_type`: customer/merchant
- `sender_name`: Sender name
- `content`: Message text
- `timestamp`: When sent

### shop_settings
- `id`: Primary key
- `shop_id`: Foreign key to shops
- `widget_color`: Hex color
- `welcome_message`: Custom greeting
- `auto_reply_enabled`: Boolean
- `created_at`, `updated_at`: Timestamps

## 🛠️ Development

### Run in Development Mode

```bash
# Backend with auto-reload
npm run server:dev

# Widget with watch mode
npm run widget:watch

# Both together
npm run dev
```

### Testing the Widget

1. Open `dist/test.html` in your browser
2. Update the `data-shop-domain` and API URLs
3. Test the chat functionality

### API Endpoints

- `GET /health` - Health check
- `GET /auth` - Start OAuth flow
- `GET /auth/callback` - OAuth callback
- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation
- `POST /api/messages` - Send message
- `GET /api/customers/:id/context` - Get customer data

## 🐛 Troubleshooting

### WebSocket Connection Issues

- Ensure `WS_PORT` is accessible
- Check firewall rules
- Verify WebSocket URL uses `wss://` in production

### Database Connection Errors

- Verify `DATABASE_URL` format
- Check database is running
- Ensure SSL is configured correctly

### OAuth Failures

- Verify API key and secret
- Check redirect URL matches Shopify settings
- Ensure shop domain is correct

### Widget Not Loading

- Check CDN URL is accessible
- Verify CORS headers
- Check browser console for errors

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Email: support@yourapp.com
- Documentation: https://docs.yourapp.com

## 🎯 Roadmap

- [ ] Automated responses / chatbot integration
- [ ] File/image attachments
- [ ] Conversation tags and categorization
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Email notifications
- [ ] Mobile apps (iOS/Android)
- [ ] Integration with help desk systems

## 🙏 Acknowledgments

- Built with React, Express, and WebSocket
- Uses Shopify API and App Bridge
- Styled with Tailwind CSS
- Icons from Lucide React

---

Made with ❤️ for Shopify merchants
