#!/bin/bash
# Aton Daemon Control Script
# Usage: aton-ctl.sh {start|stop|restart|status|logs|tail|attach}
#
# Uses screen for persistence (required for iMessage permissions)

SCREEN_NAME="aton"
LOG_DIR="$HOME/.openclaw/logs"
LOG_FILE="$LOG_DIR/aton-daemon.log"
ERR_FILE="$LOG_DIR/aton-daemon.err.log"
HEARTBEAT_FILE="/tmp/aton-daemon.alive"
BOT_DIR="$HOME/oni/aton/logan/workspace/bot"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$LOG_DIR"

is_running() {
    screen -list | grep -q "$SCREEN_NAME"
}

case "${1:-status}" in
    start)
        echo -e "${BLUE}Starting Aton daemon...${NC}"

        # Check if already running
        if is_running; then
            echo -e "${YELLOW}Aton is already running. Use 'restart' to reload.${NC}"
            exit 0
        fi

        # Start in screen session
        cd "$BOT_DIR"
        screen -dmS "$SCREEN_NAME" bash -c "node index.js 2>&1 | tee -a $LOG_FILE"
        sleep 3

        if is_running; then
            echo -e "${GREEN}✅ Aton daemon started successfully${NC}"
            echo "   Logs: $LOG_FILE"
            echo "   Attach: $0 attach"
        else
            echo -e "${RED}❌ Failed to start Aton daemon${NC}"
            echo "   Check logs: $LOG_FILE"
            exit 1
        fi
        ;;

    stop)
        echo -e "${BLUE}Stopping Aton daemon...${NC}"

        if ! is_running; then
            echo -e "${YELLOW}Aton is not running.${NC}"
            exit 0
        fi

        # Send quit to screen session
        screen -S "$SCREEN_NAME" -X quit
        sleep 2

        # Force kill if still running
        if is_running; then
            pkill -f "workspace/bot/index.js"
            sleep 1
        fi

        if ! is_running; then
            echo -e "${GREEN}✅ Aton daemon stopped${NC}"
        else
            echo -e "${RED}❌ Failed to stop Aton daemon${NC}"
            exit 1
        fi
        ;;

    restart)
        echo -e "${BLUE}Restarting Aton daemon...${NC}"
        $0 stop
        sleep 2
        $0 start
        ;;

    attach)
        if ! is_running; then
            echo -e "${RED}Aton is not running. Start it first with: $0 start${NC}"
            exit 1
        fi
        echo -e "${BLUE}Attaching to Aton session (Ctrl+A D to detach)...${NC}"
        screen -r "$SCREEN_NAME"
        ;;

    status)
        echo -e "${BLUE}=== Aton Daemon Status ===${NC}"
        echo ""

        # Check if running
        if is_running; then
            PID=$(pgrep -f "workspace/bot/index.js" | head -1)
            echo -e "Process: ${GREEN}Running${NC} (PID: $PID, screen: $SCREEN_NAME)"
        else
            echo -e "Process: ${RED}Stopped${NC}"
        fi

        # Check heartbeat
        if [ -f "$HEARTBEAT_FILE" ]; then
            HEARTBEAT=$(cat "$HEARTBEAT_FILE" 2>/dev/null)
            TIMESTAMP=$(echo "$HEARTBEAT" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
            UPTIME=$(echo "$HEARTBEAT" | grep -o '"uptime":[0-9.]*' | cut -d':' -f2)

            if [ -n "$TIMESTAMP" ]; then
                echo -e "Heartbeat: ${GREEN}$TIMESTAMP${NC}"
                if [ -n "$UPTIME" ]; then
                    HOURS=$(echo "scale=1; $UPTIME / 3600" | bc)
                    echo -e "Uptime: ${GREEN}${HOURS}h${NC}"
                fi
            fi
        else
            echo -e "Heartbeat: ${YELLOW}No heartbeat file${NC}"
        fi

        # Check database
        DB_FILE="$BOT_DIR/aton-memory.db"
        if [ -f "$DB_FILE" ]; then
            USERS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM users" 2>/dev/null || echo "?")
            PROJECTS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM projects" 2>/dev/null || echo "?")
            PENDING=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM work_queue WHERE status='pending'" 2>/dev/null || echo "?")
            RUNNING=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM work_queue WHERE status='running'" 2>/dev/null || echo "?")

            echo ""
            echo "Database:"
            echo "  Users: $USERS"
            echo "  Projects: $PROJECTS"
            echo "  Work Queue: $PENDING pending, $RUNNING running"
        fi

        # Log file stats
        echo ""
        echo "Logs:"
        if [ -f "$LOG_FILE" ]; then
            SIZE=$(du -h "$LOG_FILE" | cut -f1)
            LINES=$(wc -l < "$LOG_FILE" | tr -d ' ')
            echo "  stdout: $SIZE ($LINES lines)"
        else
            echo "  stdout: (not created yet)"
        fi
        if [ -f "$ERR_FILE" ]; then
            SIZE=$(du -h "$ERR_FILE" | cut -f1)
            echo "  stderr: $SIZE"
        fi
        ;;

    logs)
        if [ -f "$LOG_FILE" ]; then
            less +G "$LOG_FILE"
        else
            echo "No log file yet at $LOG_FILE"
        fi
        ;;

    tail)
        echo -e "${BLUE}Tailing Aton logs (Ctrl+C to stop)...${NC}"
        tail -f "$LOG_FILE" "$ERR_FILE" 2>/dev/null
        ;;

    install)
        echo -e "${BLUE}Installing Aton daemon...${NC}"

        # Check node
        if ! command -v node &> /dev/null; then
            echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
            exit 1
        fi

        # Check screen
        if ! command -v screen &> /dev/null; then
            echo -e "${RED}❌ screen not found. Please install screen.${NC}"
            exit 1
        fi

        NODE_PATH=$(which node)
        echo "Node: $NODE_PATH"

        # Install dependencies
        echo "Installing dependencies..."
        cd "$BOT_DIR" && npm install

        # Create login item script
        STARTUP_SCRIPT="$HOME/.openclaw/start-aton.sh"
        cat > "$STARTUP_SCRIPT" << 'STARTUP'
#!/bin/bash
# Auto-start Aton daemon
sleep 10  # Wait for system to settle
/Users/heir/oni/aton/logan/workspace/scripts/aton-ctl.sh start
STARTUP
        chmod +x "$STARTUP_SCRIPT"

        echo -e "${GREEN}✅ Installation complete${NC}"
        echo ""
        echo "To start: $0 start"
        echo "To auto-start on login: Add $STARTUP_SCRIPT to Login Items"
        ;;

    uninstall)
        echo -e "${BLUE}Uninstalling Aton daemon...${NC}"
        $0 stop 2>/dev/null
        rm -f "$HOME/.openclaw/start-aton.sh"
        echo -e "${GREEN}✅ Aton daemon uninstalled${NC}"
        ;;

    *)
        echo "Aton Daemon Control"
        echo ""
        echo "Usage: $0 {command}"
        echo ""
        echo "Commands:"
        echo "  start     - Start the Aton daemon"
        echo "  stop      - Stop the Aton daemon"
        echo "  restart   - Restart the Aton daemon"
        echo "  status    - Show daemon status and stats"
        echo "  logs      - View full logs"
        echo "  tail      - Tail logs in real-time"
        echo "  attach    - Attach to running daemon (Ctrl+A D to detach)"
        echo "  install   - First-time setup"
        echo "  uninstall - Remove daemon"
        exit 1
        ;;
esac
