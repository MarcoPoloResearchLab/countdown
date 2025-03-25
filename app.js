// GoogleSignInButton component polls for google.accounts.id availability
const GoogleSignInButton = {
    template: `<div ref="buttonContainer"></div>`,
    mounted() {
        const renderButton = () => {
            if (
                window.google &&
                google.accounts &&
                google.accounts.id
            ) {
                google.accounts.id.renderButton(
                    this.$refs.buttonContainer,
                    { theme: 'outline', size: 'large' }
                );
                clearInterval(this.checkInterval);
            }
        };
        renderButton();
        if (
            !window.google ||
            !google.accounts ||
            !google.accounts.id
        ) {
            // Check every 100ms until the API is available.
            this.checkInterval = setInterval(renderButton, 100);
        }
    },
    beforeUnmount() {
        if (this.checkInterval) clearInterval(this.checkInterval);
    }
};

// UserProfile component displays the signed-in user's info
const UserProfile = {
    props: ['user'],
    template: `
    <div class="user-section">
      <img :src="user.picture" alt="Profile" class="user-pic" referrerpolicy="no-referrer">
      <span class="user-name">{{ user.name }}</span>
      <button @click="$emit('sign-out')" class="button">Sign Out</button>
    </div>
  `
};

const app = Vue.createApp({
    components: {
        GoogleSignInButton,
        UserProfile
    },
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
                { value: "weeksLeft", label: "Weeks" }
            ],
            today: new Date().toISOString().split("T")[0],
            dayHeaders: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            user: null, // The user object (if signed in)
            errorMessage: null,
            startMonth: null, // Tracks the month for the start date calendar
            endMonth: null   // Tracks the month for the end date calendar
        };
    },
    computed: {
        // Determines if a user is signed in
        isSignedIn() {
            return this.user !== null;
        },
        // Shows the end calendar only if start and end dates are in different months/years
        showEndCalendar() {
            if (!this.startDate || !this.endDate) return false;
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            return start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear();
        },
        // Displays the month and year for the start date calendar
        startMonthYear() {
            if (!this.startMonth) return "Select Start Date";
            return this.startMonth.toLocaleString("default", {
                month: "long",
                year: "numeric"
            });
        },
        // Displays the month and year for the end date calendar
        endMonthYear() {
            if (!this.endMonth) return "Select End Date";
            return this.endMonth.toLocaleString("default", {
                month: "long",
                year: "numeric"
            });
        },
        // Generates days for the start date calendar
        startCalendarDays() {
            if (!this.startMonth) return [];
            const yearValue = this.startMonth.getFullYear();
            const monthValue = this.startMonth.getMonth();
            return this.generateCalendarDays(yearValue, monthValue);
        },
        // Generates days for the end date calendar (if shown)
        endCalendarDays() {
            if (!this.endMonth || !this.showEndCalendar) return [];
            const yearValue = this.endMonth.getFullYear();
            const monthValue = this.endMonth.getMonth();
            return this.generateCalendarDays(yearValue, monthValue);
        },
        metricLabel() {
            switch (this.selectedMetric) {
                case "workingDays": return "Working Days";
                case "workingHours": return "Working Hours";
                case "totalDays": return "Total Days";
                case "totalHours": return "Total Hours";
                case "totalSeconds": return "Total Seconds";
                case "weeksLeft": return "Weeks";
                default: return "Metric";
            }
        },
        displayValue() {
            switch (this.selectedMetric) {
                case "workingDays": return this.workingDaysLeft;
                case "workingHours": return this.workingHoursLeft;
                case "totalDays": return this.totalDaysLeft;
                case "totalHours": return this.totalHoursLeft;
                case "totalSeconds": return this.totalSecondsLeft;
                case "weeksLeft": return this.weeksLeft;
                default: return 0;
            }
        }
    },
    watch: {
        startDate(newValue) {
            if (newValue) {
                const start = new Date(newValue);
                this.startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
            } else {
                this.startMonth = null;
            }
            this.calcAllMetrics();
            this.saveDates();
        },
        endDate(newValue) {
            if (newValue) {
                const end = new Date(newValue);
                this.endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
            } else {
                this.endMonth = null;
            }
            this.calcAllMetrics();
            this.saveDates();
        },
        user: {
            handler(newUser) {
                if (newUser) {
                    this.restoreDates();
                    this.calcAllMetrics();
                } else {
                    this.startDate = this.today;
                    this.endDate = "";
                    localStorage.removeItem("dates");
                }
            },
            deep: true
        }
    },
    methods: {
        saveDates() {
            const dates = {
                startDate: this.startDate,
                endDate: this.endDate
            };
            localStorage.setItem("dates", JSON.stringify(dates));
        },
        restoreDates() {
            const savedDates = localStorage.getItem("dates");
            if (savedDates) {
                const dates = JSON.parse(savedDates);
                this.startDate = dates.startDate || this.today;
                this.endDate = dates.endDate || "";
            }
        },
        handleSignOut() {
            this.user = null;
            this.errorMessage = null;
            localStorage.removeItem("user");
            localStorage.removeItem("dates");
            google.accounts.id.disableAutoSelect();
        },
        handleCredentialResponse(response) {
            try {
                const decodedToken = this.parseJwt(response.credential);
                if (!decodedToken) {
                    throw new Error("Invalid token received.");
                }
                this.user = decodedToken;
                this.errorMessage = null;
                localStorage.setItem("user", JSON.stringify(decodedToken));
                this.restoreDates();
                this.calcAllMetrics();
            } catch (error) {
                this.errorMessage = "Authentication failed. Please try again.";
                console.error("Authentication error:", error);
            }
        },
        parseJwt(token) {
            try {
                return JSON.parse(atob(token.split(".")[1]));
            } catch (error) {
                return null;
            }
        },
        initializeGoogleSignIn() {
            google.accounts.id.initialize({
                client_id: "74022320040-5aaq169bkriqitue3dcqi8g2o3vk5q16.apps.googleusercontent.com",
                callback: this.handleCredentialResponse.bind(this)
            });
        },
        calcAllMetrics() {
            if (!this.startDate || !this.endDate) {
                this.workingDaysLeft = 0;
                this.totalDaysLeft = 0;
                this.workingHoursLeft = 0;
                this.totalHoursLeft = 0;
                this.totalSecondsLeft = 0;
                this.weeksLeft = 0;
                return;
            }
            const start = new Date(this.startDate);
            const end = new Date(this.endDate);
            let totalDays = 0;
            if (end >= start) {
                totalDays = Math.floor((end - start) / (1000 * 3600 * 24)) + 1;
            }
            let workingDays = 0;
            for (
                let tempDate = new Date(start);
                tempDate <= end;
                tempDate.setDate(tempDate.getDate() + 1)
            ) {
                if (this.isWorkingDay(tempDate) && !this.isVacationDay(tempDate)) {
                    workingDays++;
                }
            }
            this.workingDaysLeft = workingDays;
            this.totalDaysLeft = totalDays;
            this.workingHoursLeft = workingDays * 8;
            this.totalHoursLeft = totalDays * 24;
            this.totalSecondsLeft = this.totalHoursLeft * 3600;
            this.weeksLeft = Math.floor(totalDays / 7);
        },
        isWorkingDay(dateValue) {
            const dayOfWeek = dateValue.getDay();
            const yearValue = dateValue.getFullYear();
            const holidays = this.getUSHolidays(yearValue);
            const dateStr = dateValue.toISOString().split("T")[0];
            return (
                dayOfWeek !== 0 &&
                dayOfWeek !== 6 &&
                !holidays.includes(dateStr)
            );
        },
        getUSHolidays(yearValue) {
            const holidays = [
                `${yearValue}-01-01`,
                this.getNthWeekdayOfMonth(yearValue, 1, 1, 3),
                this.getNthWeekdayOfMonth(yearValue, 2, 1, 3),
                this.getLastWeekdayOfMonth(yearValue, 5, 1),
                `${yearValue}-06-19`,
                `${yearValue}-07-04`,
                this.getNthWeekdayOfMonth(yearValue, 9, 1, 1),
                this.getNthWeekdayOfMonth(yearValue, 10, 1, 2),
                `${yearValue}-11-11`,
                this.getNthWeekdayOfMonth(yearValue, 11, 4, 4),
                `${yearValue}-12-25`
            ];
            const adjustedHolidays = holidays.map(holiday => {
                const date = new Date(holiday);
                const day = date.getDay();
                if (day === 6) {
                    date.setDate(date.getDate() - 1);
                    return date.toISOString().split("T")[0];
                }
                if (day === 0) {
                    date.setDate(date.getDate() + 1);
                    return date.toISOString().split("T")[0];
                }
                return holiday;
            });
            return adjustedHolidays;
        },
        getNthWeekdayOfMonth(yearValue, monthNumber, weekdayNumber, occurrenceNumber) {
            const date = new Date(yearValue, monthNumber - 1, 1);
            let count = 0;
            while (count < occurrenceNumber) {
                if (date.getDay() === weekdayNumber) {
                    count++;
                }
                if (count < occurrenceNumber) {
                    date.setDate(date.getDate() + 1);
                }
            }
            return date.toISOString().split("T")[0];
        },
        getLastWeekdayOfMonth(yearValue, monthNumber, weekdayNumber) {
            const tempDate = new Date(yearValue, monthNumber, 0);
            const tempWeekday = tempDate.getDay();
            const difference = (tempWeekday - weekdayNumber + 7) % 7;
            const dayInMonth = tempDate.getDate() - difference;
            return new Date(yearValue, monthNumber - 1, dayInMonth)
                .toISOString()
                .split("T")[0];
        },
        isVacationDay(dateValue) {
            for (const vac of this.vacations) {
                if (!vac.start || !vac.end) continue;
                const vacationStart = new Date(vac.start);
                const vacationEnd = new Date(vac.end);
                if (dateValue >= vacationStart && dateValue <= vacationEnd)
                    return true;
            }
            return false;
        },
        addVacation() {
            this.vacations.push({ start: "", end: "" });
        },
        removeVacation(indexValue) {
            this.vacations.splice(indexValue, 1);
        },
        onVacationChange(indexValue) {
            const vac = this.vacations[indexValue];
            if (vac.start) {
                const startDateValue = new Date(vac.start);
                const nextDay = new Date(startDateValue);
                nextDay.setDate(startDateValue.getDate() + 1);
                const formatted = nextDay.toISOString().split("T")[0];
                if (!vac.end || vac.end < vac.start) {
                    this.vacations[indexValue].end = formatted;
                }
            }
            this.calcAllMetrics();
        },
        previousMonth(type) {
            if (type === "start" && this.startMonth) {
                this.startMonth = new Date(
                    this.startMonth.getFullYear(),
                    this.startMonth.getMonth() - 1,
                    1
                );
            } else if (type === "end" && this.endMonth) {
                this.endMonth = new Date(
                    this.endMonth.getFullYear(),
                    this.endMonth.getMonth() - 1,
                    1
                );
            }
        },
        nextMonth(type) {
            if (type === "start" && this.startMonth) {
                this.startMonth = new Date(
                    this.startMonth.getFullYear(),
                    this.startMonth.getMonth() + 1,
                    1
                );
            } else if (type === "end" && this.endMonth) {
                this.endMonth = new Date(
                    this.endMonth.getFullYear(),
                    this.endMonth.getMonth() + 1,
                    1
                );
            }
        },
        generateCalendarDays(yearValue, monthValue) {
            const firstDay = new Date(yearValue, monthValue, 1);
            const lastDay = new Date(yearValue, monthValue + 1, 0);
            const days = [];
            const now = new Date();
            const startDate = this.startDate ? new Date(this.startDate) : null;
            const endDate = this.endDate ? new Date(this.endDate) : null;

            // Leading days from previous month
            for (let dayIndex = 0; dayIndex < firstDay.getDay(); dayIndex++) {
                const tempDate = new Date(yearValue, monthValue, -dayIndex);
                days.unshift({ date: tempDate, otherMonth: true, isToday: false, isStartDate: false, isEndDate: false });
            }

            // Days of the current month
            for (let dateNumber = 1; dateNumber <= lastDay.getDate(); dateNumber++) {
                const tempDate = new Date(yearValue, monthValue, dateNumber);
                days.push({
                    date: tempDate,
                    otherMonth: false,
                    isToday: tempDate.toDateString() === now.toDateString(),
                    isStartDate: startDate && tempDate.toDateString() === startDate.toDateString(),
                    isEndDate: endDate && tempDate.toDateString() === endDate.toDateString()
                });
            }

            // Trailing days from next month
            const leftoverCells = 7 - (days.length % 7);
            if (leftoverCells < 7) {
                for (let dateNumber = 1; dateNumber <= leftoverCells; dateNumber++) {
                    const tempDate = new Date(yearValue, monthValue + 1, dateNumber);
                    days.push({ date: tempDate, otherMonth: true, isToday: false, isStartDate: false, isEndDate: false });
                }
            }

            return days;
        }
    },
    mounted() {
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
            this.user = JSON.parse(savedUser);
        } else {
            this.startDate = this.today;
        }
    
        let checkInterval; // Define checkInterval in the outer scope
        const initGoogle = () => {
            if (window.google) {
                console.log("App: Initializing Google Sign-In");
                this.initializeGoogleSignIn();
                if (checkInterval) {
                    clearInterval(checkInterval); // Now checkInterval is accessible
                }
            } else {
                console.log("App: Google API not yet available");
            }
        };
        initGoogle();
        if (!window.google) {
            checkInterval = setInterval(initGoogle, 100); // Assign to the outer-scoped variable
            setTimeout(() => {
                if (checkInterval) {
                    clearInterval(checkInterval);
                }
            }, 5000); // Stop after 5 seconds
        }
    
        this.calcAllMetrics();
    }
});

app.mount("#app");
