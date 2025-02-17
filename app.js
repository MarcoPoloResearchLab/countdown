const app = Vue.createApp({
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
                {value: "workingDays", label: "Working Days Left"},
                {value: "totalDays", label: "Total Days Left"},
                {value: "workingHours", label: "Working Hours Left"},
                {value: "totalHours", label: "Total Hours Left"},
                {value: "totalSeconds", label: "Total Seconds Left"},
                {value: "weeksLeft", label: "Weeks Left"}
            ],
            today: new Date().toISOString().split("T")[0],
            currentMonth: new Date(),
            dayHeaders: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            user: null, // Stores the user object (name, email, picture, etc.)
            errorMessage: null
        };
    },
    computed: {
        monthYear() {
            return this.currentMonth.toLocaleString("default", {month: "long", year: "numeric"});
        },
        calendarDays() {
            const yearValue = this.currentMonth.getFullYear();
            const monthValue = this.currentMonth.getMonth();
            const firstDay = new Date(yearValue, monthValue, 1);
            const lastDay = new Date(yearValue, monthValue + 1, 0);
            const days = [];
            const now = new Date();
            for (let dayIndex = 0; dayIndex < firstDay.getDay(); dayIndex++) {
                const tempDate = new Date(yearValue, monthValue, -dayIndex);
                days.unshift({date: tempDate, otherMonth: true, isToday: false});
            }
            for (let dateNumber = 1; dateNumber <= lastDay.getDate(); dateNumber++) {
                const tempDate = new Date(yearValue, monthValue, dateNumber);
                days.push({
                    date: tempDate,
                    otherMonth: false,
                    isToday: tempDate.toDateString() === now.toDateString()
                });
            }
            const leftoverCells = 7 - (days.length % 7);
            if (leftoverCells < 7) {
                for (let dateNumber = 1; dateNumber <= leftoverCells; dateNumber++) {
                    const tempDate = new Date(yearValue, monthValue + 1, dateNumber);
                    days.push({date: tempDate, otherMonth: true, isToday: false});
                }
            }
            return days;
        },
        metricLabel() {
            switch (this.selectedMetric) {
                case "workingDays":
                    return "Working Days Left";
                case "workingHours":
                    return "Working Hours Left";
                case "totalDays":
                    return "Total Days Left";
                case "totalHours":
                    return "Total Hours Left";
                case "totalSeconds":
                    return "Total Seconds Left";
                case "weeksLeft":
                    return "Weeks Left";
                default:
                    return "Metric";
            }
        },
        displayValue() {
            switch (this.selectedMetric) {
                case "workingDays":
                    return this.workingDaysLeft;
                case "workingHours":
                    return this.workingHoursLeft;
                case "totalDays":
                    return this.totalDaysLeft;
                case "totalHours":
                    return this.totalHoursLeft;
                case "totalSeconds":
                    return this.totalSecondsLeft;
                case "weeksLeft":
                    return this.weeksLeft;
                default:
                    return 0;
            }
        }
    },
    watch: {
        // Watch for changes in startDate and endDate and recalculate metrics
        startDate() {
            this.calcAllMetrics();
        },
        endDate() {
            this.calcAllMetrics();
        }
    },
    methods: {
        parseJwt(token) {
            try {
                return JSON.parse(atob(token.split('.')[1]));
            } catch (error) {
                return null;
            }
        },

        handleCredentialResponse(response) {
            try {
                const decodedToken = this.parseJwt(response.credential);

                if (!decodedToken) {
                    throw new Error("Invalid token received.");
                }

                // Store the complete decoded token as the user object
                this.user = decodedToken;
                this.errorMessage = null;
                localStorage.setItem('user', JSON.stringify(decodedToken));
            } catch (error) {
                this.errorMessage = "Authentication failed. Please try again.";
                console.error("Authentication error:", error);
            }
        },

        handleSignOut() {
            this.user = null;
            this.errorMessage = null;
            localStorage.removeItem('user'); // Remove user from localStorage
            google.accounts.id.disableAutoSelect();
        },

        initializeGoogleSignIn() {
            google.accounts.id.initialize({
                client_id: '74022320040-5aaq169bkriqitue3dcqi8g2o3vk5q16.apps.googleusercontent.com',
                callback: this.handleCredentialResponse.bind(this)
            });

            google.accounts.id.renderButton(
                document.getElementById('googleSignInButton'),
                { theme: 'outline', size: 'large' }
            );
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
            for (let tempDate = new Date(start); tempDate <= end; tempDate.setDate(tempDate.getDate() + 1)) {
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
            return dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.includes(dateStr);
        },

        getUSHolidays(yearValue) {
            return [
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
        },

        getNthWeekdayOfMonth(yearValue, monthNumber, weekdayNumber, occurrenceNumber) {
            const firstDay = new Date(yearValue, monthNumber - 1, 1);
            const firstDayOfWeek = firstDay.getDay();
            let dayInMonth = ((weekdayNumber - firstDayOfWeek + 7) % 7) + 1 + (occurrenceNumber - 1) * 7;
            if (dayInMonth > new Date(yearValue, monthNumber, 0).getDate()) {
                dayInMonth -= 7;
            }
            return new Date(yearValue, monthNumber - 1, dayInMonth).toISOString().split("T")[0];
        },

        getLastWeekdayOfMonth(yearValue, monthNumber, weekdayNumber) {
            const tempDate = new Date(yearValue, monthNumber, 0);
            const tempWeekday = tempDate.getDay();
            let difference = (tempWeekday - weekdayNumber + 7) % 7;
            const dayInMonth = tempDate.getDate() - difference;
            return new Date(yearValue, monthNumber - 1, dayInMonth).toISOString().split("T")[0];
        },

        isVacationDay(dateValue) {
            for (const vac of this.vacations) {
                if (!vac.start || !vac.end) continue;
                const vacationStart = new Date(vac.start);
                const vacationEnd = new Date(vac.end);
                if (dateValue >= vacationStart && dateValue <= vacationEnd) return true;
            }
            return false;
        },

        addVacation() {
            this.vacations.push({start: "", end: ""});
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

        previousMonth() {
            this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
        },

        nextMonth() {
            this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
        }
    },
    mounted() {
        // Restore user from localStorage if available
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            this.user = JSON.parse(savedUser);
        }

        // Initialize Google Sign-In
        if (window.google) {
            this.initializeGoogleSignIn();
        } else {
            window.onload = () => this.initializeGoogleSignIn();
        }

        this.startDate = this.today;
        this.calcAllMetrics();
    }
});

app.mount("#app");