const GoogleSignInButton = {
  template: `<div ref="buttonContainer"></div>`,
  props: ["googleApiReady"],
  mounted() {
    this.renderIfReady();
  },
  watch: {
    googleApiReady(isReady) {
      if (isReady) this.$nextTick(() => this.renderIfReady());
    },
  },
  methods: {
    renderIfReady() {
      if (
        this.googleApiReady &&
        window.google &&
        google.accounts &&
        google.accounts.id &&
        this.$refs.buttonContainer
      ) {
        try {
          google.accounts.id.renderButton(this.$refs.buttonContainer, {
            theme: "outline",
            size: "large",
          });
        } catch (error) {
          console.error("GoogleSignInButton: Error rendering:", error);
        }
      }
    },
  },
};

// --- UserProfile component ---
const UserProfile = {
  props: ["user"],
  emits: ["sign-out"],
  template: `
  <div class="user-section">
    <img v-if="user && user.picture" :src="user.picture" alt="Profile" class="user-pic" referrerpolicy="no-referrer">
    <span v-if="user && user.name" class="user-name">{{ user.name }}</span>
    <button @click="$emit('sign-out')" class="button">Sign Out</button>
  </div>
`,
};

// --- Main Vue App ---
const app = Vue.createApp({
  components: { GoogleSignInButton, UserProfile },
  data() {
    return {
      startDate: "",
      endDate: "",
      vacations: [],
      workingDaysLeft: 0,
      totalDaysLeft: 0,
      workingHoursLeft: 0,
      totalHoursLeft: 0,
      totalSecondsLeft: 0,
      weeksLeft: 0,
      selectedMetric: "workingDays",
      metricOptions: [
        { value: "workingDays", label: "Working Days" },
        { value: "totalDays", label: "Total Days" },
        { value: "workingHours", label: "Working Hours" },
        { value: "totalHours", label: "Total Hours" },
        { value: "totalSeconds", label: "Total Seconds" },
        { value: "weeksLeft", label: "Weeks" },
        { value: "workingWeeks", label: "Working Weeks" },
      ],
      today: new Date().toISOString().split("T")[0],
      dayHeaders: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      user: null,
      errorMessage: null,
      startMonth: null,
      endMonth: null,
      googleApiReady: false,
      googleInitInterval: null,
    };
  },
  computed: {
    isSignedIn() {
      return this.user !== null;
    },
    showEndCalendar() {
      if (!this.startDate || !this.endDate) return false;
      try {
        const start = this.parseDateStringToLocal(this.startDate);
        const end = this.parseDateStringToLocal(this.endDate);
        return (
          start &&
          end &&
          (start.getMonth() !== end.getMonth() ||
            start.getFullYear() !== end.getFullYear())
        );
      } catch (e) {
        return false;
      }
    },
    startMonthYear() {
      if (!this.startMonth || !(this.startMonth instanceof Date))
        return "Select Start Date";
      return this.startMonth.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    },
    endMonthYear() {
      if (!this.endDate || !this.showEndCalendar) return "";
      if (!this.endMonth || !(this.endMonth instanceof Date)) {
        const end = this.parseDateStringToLocal(this.endDate);
        if (end) this.endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
        else return "Select End Date";
      }
      return this.endMonth.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
    },
    startCalendarDays() {
      if (!this.startMonth || !(this.startMonth instanceof Date)) return [];
      return this.generateCalendarDays(
        this.startMonth.getFullYear(),
        this.startMonth.getMonth()
      );
    },
    endCalendarDays() {
      if (
        !this.showEndCalendar ||
        !this.endMonth ||
        !(this.endMonth instanceof Date)
      )
        return [];
      return this.generateCalendarDays(
        this.endMonth.getFullYear(),
        this.endMonth.getMonth()
      );
    },
    metricLabel() {
      const option = this.metricOptions.find(
        (opt) => opt.value === this.selectedMetric
      );
      return option ? option.label : "Metric";
    },
    displayValue() {
      switch (this.selectedMetric) {
        case "workingDays":
          return this.workingDaysLeft.toLocaleString();
        case "workingHours":
          return this.workingHoursLeft.toLocaleString();
        case "totalDays":
          return this.totalDaysLeft.toLocaleString();
        case "totalHours":
          return this.totalHoursLeft.toLocaleString();
        case "totalSeconds":
          return this.totalSecondsLeft.toLocaleString();
        case "weeksLeft":
          return this.weeksLeft.toLocaleString();
        case "workingWeeks":
          return this.workingWeeksLeft.toLocaleString();
        default:
          return 0;
      }
    },
  },
  watch: {
    startDate(newValue, oldValue) {
      if (newValue === oldValue) return;
      const start = this.parseDateStringToLocal(newValue);
      this.startMonth = start
        ? new Date(start.getFullYear(), start.getMonth(), 1)
        : null;
      if (start && this.endDate) {
        const end = this.parseDateStringToLocal(this.endDate);
        if (end && end < start) this.endDate = newValue;
      }
      this.updateEndMonthView();
      this.calcAllMetrics();
      this.saveUserData();
    },
    endDate(newValue, oldValue) {
      if (newValue === oldValue) return;
      const end = this.parseDateStringToLocal(newValue);

      if (end) {
        const start = this.parseDateStringToLocal(this.startDate);
        // Check if the newly selected end date is before the start date
        if (start && end < start) {
          console.warn(
            "End date cannot be before start date. Setting end date to day after start date."
          );

          const nextDay = new Date(start); // Create date from start
          nextDay.setDate(start.getDate() + 1); // Increment day by 1
          const formattedNextDay = this.formatDateToYMD(nextDay); // Format to YYYY-MM-DD

          // Use $nextTick for safety when updating watched prop inside watcher
          this.$nextTick(() => {
            this.endDate = formattedNextDay; // Set end date to the calculated next day
          });
          // Stop further processing in *this* watcher run, as the update will trigger it again.
          return;
        }
      } else if (newValue !== "") {
        // Optional: Handle case where input is cleared or is invalid format
        console.warn("Invalid end date entered or cleared:", newValue);
      }

      this.updateEndMonthView();
      this.calcAllMetrics();
      this.saveUserData();
    },
    vacations: {
      handler() {
        this.calcAllMetrics();
        this.saveUserData();
      },
      deep: true,
    },
  },
  methods: {
    formatDateToYMD(date) {
      if (!date || !(date instanceof Date)) return "";
      const year = date.getFullYear();
      const month = ("0" + (date.getMonth() + 1)).slice(-2); // Months are 0-indexed
      const day = ("0" + date.getDate()).slice(-2);
      return `${year}-${month}-${day}`;
    },
    // --- Keep robust parseDateStringToLocal ---
    parseDateStringToLocal(dateStr) {
      if (!dateStr || typeof dateStr !== "string") return null;
      try {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = parseInt(match[1], 10),
          month = parseInt(match[2], 10),
          day = parseInt(match[3], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        const dt = new Date(year, month - 1, day);
        return dt.getFullYear() === year &&
          dt.getMonth() === month - 1 &&
          dt.getDate() === day
          ? dt
          : null;
      } catch (e) {
        console.error("Error parsing date:", dateStr, e);
        return null;
      }
    },
    getUserDataKey() {
      return this.user && this.user.sub
        ? `countdownUserData-${this.user.sub}`
        : null;
    },
    saveUserData() {
      const userKey = this.getUserDataKey();
      if (userKey) {
        const userData = {
          startDate: this.startDate,
          endDate: this.endDate,
          vacations: this.vacations.filter(
            (v) => v && typeof v.start === "string" && typeof v.end === "string"
          ),
        };
        try {
          localStorage.setItem(userKey, JSON.stringify(userData));
        } catch (e) {
          console.error("Failed to save user data:", e);
          this.errorMessage = "Could not save settings.";
        }
      }
    },
    restoreUserData() {
      this.setDefaultState();
      const userKey = this.getUserDataKey();
      if (userKey) {
        const savedData = localStorage.getItem(userKey);
        if (savedData) {
          try {
            const userData = JSON.parse(savedData);
            const restoredStart =
              userData.startDate &&
              typeof userData.startDate === "string" &&
              this.parseDateStringToLocal(userData.startDate);
            const restoredEnd =
              userData.endDate &&
              typeof userData.endDate === "string" &&
              this.parseDateStringToLocal(userData.endDate);
            const restoredVacations = Array.isArray(userData.vacations)
              ? userData.vacations.filter(
                  (v) =>
                    v &&
                    this.parseDateStringToLocal(v.start) &&
                    this.parseDateStringToLocal(v.end)
                )
              : [];
            if (restoredStart) this.startDate = userData.startDate;
            if (restoredEnd) this.endDate = userData.endDate;
            if (
              restoredStart &&
              restoredEnd &&
              this.parseDateStringToLocal(this.endDate) <
                this.parseDateStringToLocal(this.startDate)
            ) {
              this.endDate = this.startDate;
            }
            this.vacations = restoredVacations;
          } catch (e) {
            console.error("Failed to parse user data:", e);
            localStorage.removeItem(userKey);
          }
        }
      }
      this.$nextTick(() => {
        this.calcAllMetrics();
      });
    },
    setDefaultState() {
      this.startDate = this.today;
      this.endDate = "";
      this.vacations = [];
      this.startMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      );
      this.endMonth = null;
    },
    updateEndMonthView() {
      const end = this.parseDateStringToLocal(this.endDate);
      this.endMonth =
        end && this.showEndCalendar
          ? new Date(end.getFullYear(), end.getMonth(), 1)
          : null;
    },
    handleSignOut() {
      const userKey = this.getUserDataKey();
      if (userKey) localStorage.removeItem(userKey);
      localStorage.removeItem("user");
      this.user = null;
      this.errorMessage = null;
      if (
        this.googleApiReady &&
        window.google &&
        google.accounts &&
        google.accounts.id
      ) {
        try {
          google.accounts.id.disableAutoSelect();
        } catch (e) {}
      }
      this.restoreUserData();
    },
    handleCredentialResponse(response) {
      try {
        const decodedToken = this.parseJwt(response.credential);
        if (!decodedToken || !decodedToken.sub)
          throw new Error("Invalid token or missing 'sub'.");
        this.user = decodedToken;
        this.errorMessage = null;
        localStorage.setItem("user", JSON.stringify(decodedToken));
        this.restoreUserData();
      } catch (error) {
        console.error("Auth error:", error);
        this.errorMessage = "Authentication failed: " + error.message;
        this.user = null;
        localStorage.removeItem("user");
        this.restoreUserData();
      }
    },
    parseJwt(token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(jsonPayload);
      } catch (error) {
        console.error("JWT parse error:", error);
        return null;
      }
    },
    initializeGoogleSignIn() {
      if (
        !this.googleApiReady ||
        !window.google ||
        !google.accounts ||
        !google.accounts.id
      )
        return;
      try {
        google.accounts.id.initialize({
          client_id:
            "74022320040-5aaq169bkriqitue3dcqi8g2o3vk5q16.apps.googleusercontent.com",
          callback: this.handleCredentialResponse.bind(this),
          auto_select: true,
        });
        if (!this.isSignedIn) google.accounts.id.prompt();
        this.$nextTick(() => {
          const btnComp = this.$refs.googleButtonComponent;
          if (btnComp && typeof btnComp.renderIfReady === "function")
            btnComp.renderIfReady();
        });
      } catch (error) {
        console.error("GSI Init Error:", error);
        this.errorMessage = "Could not init Google Sign-In.";
      }
    },
    checkGoogleApi() {
      if (window.google && google.accounts && google.accounts.id) {
        if (this.googleInitInterval) {
          clearInterval(this.googleInitInterval);
          this.googleInitInterval = null;
        }
        if (!this.googleApiReady) {
          this.googleApiReady = true;
          this.initializeGoogleSignIn();
        }
      }
    },
    calcAllMetrics() {
      this.resetMetrics();
      const start = this.parseDateStringToLocal(this.startDate);
      const end = this.parseDateStringToLocal(this.endDate);
      if (!start || !end || end < start) return;
      let totalDays =
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
        1;
      let workingDays = 0;
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();
      const holidaysMap = new Map();
      for (let yr = startYear; yr <= endYear; yr++) {
        holidaysMap.set(yr, new Set(this.getUSHolidays(yr)));
      }
      let tempDate = new Date(start);
      while (tempDate <= end) {
        const year = tempDate.getFullYear();
        if (
          this.isWorkingDay(tempDate, holidaysMap.get(year)) &&
          !this.isVacationDay(tempDate)
        ) {
          workingDays++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      this.workingDaysLeft = workingDays;
      this.totalDaysLeft = totalDays;
      this.workingHoursLeft = workingDays * 8;
      this.totalHoursLeft = totalDays * 24;
      this.totalSecondsLeft = this.totalHoursLeft * 3600;
      this.weeksLeft = Math.floor(totalDays / 7);
      this.workingWeeksLeft = Math.floor(workingDays / 5);
    },
    resetMetrics() {
      this.workingDaysLeft = 0;
      this.totalDaysLeft = 0;
      this.workingHoursLeft = 0;
      this.totalHoursLeft = 0;
      this.totalSecondsLeft = 0;
      this.weeksLeft = 0;
      this.workingWeeksLeft = 0;
    },
    isWorkingDay(date, yearHolidaysSet) {
      if (!date || !(date instanceof Date)) return false;
      const dayOfWeek = date.getDay();
      const dateStr =
        date.getFullYear() +
        "-" +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        "-" +
        ("0" + date.getDate()).slice(-2);
      return (
        dayOfWeek !== 0 &&
        dayOfWeek !== 6 &&
        !(yearHolidaysSet && yearHolidaysSet.has(dateStr))
      );
    },
    getUSHolidays(year) {
      const holidayChecks = [
        { type: "fixed", month: 0, day: 1 },
        { type: "nthWeekday", month: 0, weekday: 1, occurrence: 3 },
        { type: "nthWeekday", month: 1, weekday: 1, occurrence: 3 },
        { type: "lastWeekday", month: 4, weekday: 1 },
        { type: "fixed", month: 5, day: 19 },
        { type: "fixed", month: 6, day: 4 },
        { type: "nthWeekday", month: 8, weekday: 1, occurrence: 1 },
        { type: "nthWeekday", month: 9, weekday: 1, occurrence: 2 },
        { type: "fixed", month: 10, day: 11 },
        { type: "nthWeekday", month: 10, weekday: 4, occurrence: 4 },
        { type: "fixed", month: 11, day: 25 },
      ];
      const holidays = [];
      holidayChecks.forEach((check) => {
        let dateStr = null;
        if (check.type === "fixed")
          dateStr = `${year}-${("0" + (check.month + 1)).slice(-2)}-${(
            "0" + check.day
          ).slice(-2)}`;
        else if (check.type === "nthWeekday")
          dateStr = this.getNthWeekdayOfMonth(
            year,
            check.month,
            check.weekday,
            check.occurrence
          );
        else if (check.type === "lastWeekday")
          dateStr = this.getLastWeekdayOfMonth(
            year,
            check.month,
            check.weekday
          );
        if (dateStr) holidays.push(dateStr);
      });
      const adjustedHolidays = new Set();
      holidays.forEach((holidayStr) => {
        const date = this.parseDateStringToLocal(holidayStr);
        if (!date) return;
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 6) {
          const observedDate = new Date(date);
          observedDate.setDate(date.getDate() - 1);
          if (observedDate.getFullYear() === year)
            adjustedHolidays.add(observedDate.toISOString().split("T")[0]);
          else adjustedHolidays.add(holidayStr);
        } else if (dayOfWeek === 0) {
          const observedDate = new Date(date);
          observedDate.setDate(date.getDate() + 1);
          if (observedDate.getFullYear() === year)
            adjustedHolidays.add(observedDate.toISOString().split("T")[0]);
          else adjustedHolidays.add(holidayStr);
        } else {
          adjustedHolidays.add(holidayStr);
        }
      });
      return [...adjustedHolidays];
    },
    getNthWeekdayOfMonth(
      year,
      monthZeroIndexed,
      weekdayNumber,
      occurrenceNumber
    ) {
      const firstOfMonth = new Date(year, monthZeroIndexed, 1);
      let dayOfWeek = firstOfMonth.getDay();
      let dayOfMonth = 1 + ((weekdayNumber - dayOfWeek + 7) % 7);
      dayOfMonth += 7 * (occurrenceNumber - 1);
      const resultDate = new Date(year, monthZeroIndexed, dayOfMonth);
      return resultDate.getMonth() === monthZeroIndexed
        ? resultDate.toISOString().split("T")[0]
        : null;
    },
    getLastWeekdayOfMonth(year, monthZeroIndexed, weekdayNumber) {
      const lastOfMonth = new Date(year, monthZeroIndexed + 1, 0);
      let dayOfWeek = lastOfMonth.getDay();
      let dayOfMonth = lastOfMonth.getDate();
      dayOfMonth -= (dayOfWeek - weekdayNumber + 7) % 7;
      const resultDate = new Date(year, monthZeroIndexed, dayOfMonth);
      return resultDate.toISOString().split("T")[0];
    },
    isVacationDay(date) {
      if (!date || !(date instanceof Date)) return false;
      const checkTime = date.getTime();
      for (const vac of this.vacations) {
        if (!vac || !vac.start || !vac.end) continue;
        const vacationStart = this.parseDateStringToLocal(vac.start);
        const vacationEnd = this.parseDateStringToLocal(vac.end);
        if (!vacationStart || !vacationEnd || vacationEnd < vacationStart)
          continue;
        if (
          checkTime >= vacationStart.getTime() &&
          checkTime <= vacationEnd.getTime()
        )
          return true;
      }
      return false;
    },
    addVacation() {
      this.vacations.push({ start: "", end: "" });
    },
    removeVacation(index) {
      if (index >= 0 && index < this.vacations.length)
        this.vacations.splice(index, 1);
    },
    onVacationChange(index) {
      const vac = this.vacations[index];
      if (vac && vac.start && vac.end) {
        const vStart = this.parseDateStringToLocal(vac.start);
        const vEnd = this.parseDateStringToLocal(vac.end);
        if (vStart && vEnd && vEnd < vStart) {
          console.warn(`Vacation ${index + 1} end < start.`);
        }
      }
    },
    previousMonth(type) {
      if (type === "start" && this.startMonth instanceof Date)
        this.startMonth = new Date(
          this.startMonth.getFullYear(),
          this.startMonth.getMonth() - 1,
          1
        );
      else if (type === "end" && this.endMonth instanceof Date)
        this.endMonth = new Date(
          this.endMonth.getFullYear(),
          this.endMonth.getMonth() - 1,
          1
        );
    },
    nextMonth(type) {
      if (type === "start" && this.startMonth instanceof Date)
        this.startMonth = new Date(
          this.startMonth.getFullYear(),
          this.startMonth.getMonth() + 1,
          1
        );
      else if (type === "end" && this.endMonth instanceof Date)
        this.endMonth = new Date(
          this.endMonth.getFullYear(),
          this.endMonth.getMonth() + 1,
          1
        );
    },
    generateCalendarDays(year, monthZeroIndexed) {
      const days = [];
      const firstOfMonth = new Date(Date.UTC(year, monthZeroIndexed, 1));
      const lastOfMonth = new Date(Date.UTC(year, monthZeroIndexed + 1, 0));
      const numDaysInMonth = lastOfMonth.getUTCDate();
      const firstDayWeekday = firstOfMonth.getUTCDay(); // 0=Sun

      const today = new Date();
      const todayString = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toDateString();

      const startDateObj = this.parseDateStringToLocal(this.startDate);
      const endDateObj = this.parseDateStringToLocal(this.endDate);
      const startDateString = startDateObj ? startDateObj.toDateString() : null;
      const endDateString = endDateObj ? endDateObj.toDateString() : null;

      // Pre-calculate holidays for the specific year being displayed
      const holidaysSet = new Set(this.getUSHolidays(year));

      // Helper to check if a day should be highlighted blue
      const checkIsWorkingDayInRange = (date) => {
        if (!startDateObj || !endDateObj) return false; // No range selected
        const dateTime = date.getTime();
        // Check if within range (inclusive)
        if (
          dateTime >= startDateObj.getTime() &&
          dateTime <= endDateObj.getTime()
        ) {
          // Check if working day AND not vacation
          return (
            this.isWorkingDay(date, holidaysSet) && !this.isVacationDay(date)
          );
        }
        return false;
      };

      // 1. Days from previous month
      const prevMonthLastDay = new Date(Date.UTC(year, monthZeroIndexed, 0));
      for (let i = firstDayWeekday; i > 0; i--) {
        const day = prevMonthLastDay.getUTCDate() - i + 1;
        const date = new Date(year, monthZeroIndexed - 1, day); // Local date
        days.push({
          date,
          otherMonth: true,
          isToday: false,
          isStartDate: date.toDateString() === startDateString,
          isEndDate: date.toDateString() === endDateString,
          isWorkingDayInRange: checkIsWorkingDayInRange(date),
        });
      }
      // 2. Days of current month
      for (let day = 1; day <= numDaysInMonth; day++) {
        const date = new Date(year, monthZeroIndexed, day); // Local date
        const dateString = date.toDateString();
        days.push({
          date,
          otherMonth: false,
          isToday: dateString === todayString,
          isStartDate: dateString === startDateString,
          isEndDate: dateString === endDateString,
          isWorkingDayInRange: checkIsWorkingDayInRange(date),
        });
      }
      // 3. Days from next month (fill to 42 cells)
      let nextMonthDay = 1;
      while (days.length < 42) {
        const date = new Date(year, monthZeroIndexed + 1, nextMonthDay++); // Local date
        days.push({
          date,
          otherMonth: true,
          isToday: false,
          isStartDate: date.toDateString() === startDateString,
          isEndDate: date.toDateString() === endDateString,
          isWorkingDayInRange: checkIsWorkingDayInRange(date),
        });
      }
      return days;
    },
  },
  mounted() {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.sub) this.user = u;
        else localStorage.removeItem("user");
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
    this.restoreUserData();
    this.checkGoogleApi();
    if (!this.googleApiReady) {
      this.googleInitInterval = setInterval(this.checkGoogleApi, 300);
      setTimeout(() => {
        if (this.googleInitInterval) {
          clearInterval(this.googleInitInterval);
          if (!this.googleApiReady)
            this.errorMessage = "Google Sign-In timed out.";
        }
      }, 8000);
    }
  },
  beforeUnmount() {
    if (this.googleInitInterval) clearInterval(this.googleInitInterval);
  },
});

app.mount("#app");
